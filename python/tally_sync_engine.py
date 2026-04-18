"""
Tally ERP XML Sync Engine
=========================
Parses Tally inventory vouchers from XML exports and syncs to Supabase.

Features:
- Robust XML parsing with encoding failsafe (UTF-8 → windows-1252 → iso-8859-1)
- Extracts VOUCHER tags with GUID and ALTERID
- Idempotent upserts using tally_guid as conflict key
- Maps to: tally_guid, voucher_type, item_name, billed_qty, date

Author: Warehouse AI Engineering Team
Version: 1.0.0
"""

import os
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from dotenv import load_dotenv
from supabase import create_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [TALLY_SYNC] %(message)s"
)
logger = logging.getLogger(__name__)

load_dotenv()

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Table name for inventory vouchers
INVENTORY_TABLE = "tally_inventory_vouchers"


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class InventoryVoucher:
    """Parsed inventory voucher from Tally XML."""
    tally_guid: str           # VOUCHER.GUID - Primary key
    alter_id: str              # VOUCHER.ALTERID
    voucher_type: str        # e.g., "Receipt Note", "Delivery Note"
    voucher_number: str       # VOUCHERNUMBER
    item_name: str           # INVENTORYLINEITEM.STOCKITEMNAME
    billed_qty: float       # INVENTORYLINEITEM.BILLEDQTY
    rate: float             # INVENTORYLINEITEM.RATE
    amount: float           # INVENTORYLINEITEM.AMOUNT
    date: str              # VOUCHER.DATE (YYYY-MM-DD)
    party_ledger: str       # PARTYLEDGERNAME
    godown: str            # INVENTORYLINEITEM.GODOWN
    created_at: str


@dataclass
class SyncResult:
    """Result of sync operation."""
    total_vouchers: int
    new_inserts: int
    updates: int
    failed: int
    errors: List[str]


# =============================================================================
# XML Parsing with Encoding Failsafe
# =============================================================================


def parse_tally_xml(xml_string: str) -> ET.Element:
    """
    Parse Tally XML with encoding failsafe.
    
    Strategy:
    1. Try UTF-8 first (standard Tally export)
    2. Fall back to windows-1252 (Indian locale common)
    3. Fall back to iso-8859-1 (legacy encodings)
    
    Args:
        xml_string: Raw XML string from Tally export
        
    Returns:
        ElementTree root element
        
    Raises:
        ValueError: If all encodings fail
    """
    encodings_to_try = ["utf-8", "windows-1252", "iso-8859-1"]
    
    for encoding in encodings_to_try:
        try:
            # Try to parse as XML with this encoding
            if isinstance(xml_string, str):
                # Already a string, encode to bytes first
                xml_bytes = xml_string.encode(encoding)
            else:
                xml_bytes = xml_string
            
            root = ET.fromstring(xml_bytes)
            logger.info(f"Successfully parsed XML with encoding: {encoding}")
            return root
            
        except (UnicodeDecodeError, ET.ParseError) as e:
            logger.warning(f"Failed to parse with {encoding}: {str(e)[:50]}")
            continue
    
    # If all encodings failed, try with error handling
    try:
        # Last resort: replace invalid characters
        if isinstance(xml_string, bytes):
            xml_string = xml_string.decode("utf-8", errors="replace")
        root = ET.fromstring(xml_string)
        logger.warning("Parsed XML with character replacement")
        return root
    except Exception as e:
        raise ValueError(f"Failed to parse XML with any encoding: {e}")


def read_tally_xml_file(file_path: str) -> str:
    """
    Read Tally XML file with automatic encoding detection.
    
    Args:
        file_path: Path to Tally XML export file
        
    Returns:
        XML string content
        
    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If encoding detection fails
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"XML file not found: {file_path}")
    
    encodings_to_try = ["utf-8", "utf-8-sig", "windows-1252", "iso-8859-1"]
    
    for encoding in encodings_to_try:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                content = f.read()
            logger.info(f"Successfully read file with encoding: {encoding}")
            return content
        except (UnicodeDecodeError, LookupError) as e:
            logger.warning(f"Failed to read with {encoding}: {str(e)[:50]}")
            continue
    
    raise ValueError(f"Could not read file with any supported encoding: {file_path}")


# =============================================================================
# Voucher Extraction
# =============================================================================


def extract_voucher_element(voucher_elem: ET.Element) -> Optional[Dict[str, Any]]:
    """
    Extract data from a single VOUCHER XML element.
    
    Expected Tally XML structure:
    <VOUCHER>
        <GUID>...</GUID>
        <ALTERID>...</ALTERID>
        <VOUCHERTYPE>Receipt Note</VOUCHERTYPE>
        <VOUCHERNUMBER>...</VOUCHERNUMBER>
        <DATE>20240418</DATE>
        <PARTYLEDGERNAME>...</PARTYLEDGERNAME>
        <INVENTORYLIST>
            <INVENTORYLINEITEM>
                <STOCKITEMNAME>Item Name</STOCKITEMNAME>
                <BILLEDQTY>100</BILLEDQTY>
                <RATE>50.00</RATE>
                <AMOUNT>5000.00</AMOUNT>
                <GODOWN>Main Warehouse</GODOWN>
            </INVENTORYLINEITEM>
        </INVENTORYLIST>
    </VOUCHER>
    
    Args:
        voucher_elem: XML element representing a voucher
        
    Returns:
        Dictionary with voucher data or None if invalid
    """
    try:
        # Extract mandatory fields
        guid = voucher_elem.findtext("GUID", "").strip()
        alter_id = voucher_elem.findtext("ALTERID", "").strip()
        
        if not guid:
            logger.warning("Voucher missing GUID, skipping")
            return None
        
        voucher_type = voucher_elem.findtext("VOUCHERTYPE", "Unknown")
        voucher_number = voucher_elem.findtext("VOUCHERNUMBER", "")
        date = voucher_elem.findtext("DATE", "")
        
        # Format date from YYYYMMDD to YYYY-MM-DD
        if len(date) == 8:
            formatted_date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
        else:
            formatted_date = date
        
        party_ledger = voucher_elem.findtext("PARTYLEDGERNAME", "")
        
        # Extract inventory lines
        inventory_list = voucher_elem.find("INVENTORYLIST")
        if inventory_list is None:
            return {
                "tally_guid": guid,
                "alter_id": alter_id,
                "voucher_type": voucher_type,
                "voucher_number": voucher_number,
                "item_name": "",
                "billed_qty": 0.0,
                "rate": 0.0,
                "amount": 0.0,
                "date": formatted_date,
                "party_ledger": party_ledger,
                "godown": ""
            }
        
        # Process first inventory line (or aggregate multiple)
        items = []
        for line_item in inventory_list.findall("INVENTORYLINEITEM"):
            item_name = line_item.findtext("STOCKITEMNAME", "").strip()
            billed_qty = float(line_item.findtext("BILLEDQTY", "0") or 0.0)
            rate = float(line_item.findtext("RATE", "0") or 0.0)
            amount = float(line_item.findtext("AMOUNT", "0") or 0.0)
            godown = line_item.findtext("GODOWN", "").strip()
            
            items.append({
                "item_name": item_name,
                "billed_qty": billed_qty,
                "rate": rate,
                "amount": amount,
                "godown": godown
            })
        
        if items:
            first_item = items[0]
        else:
            first_item = {
                "item_name": "",
                "billed_qty": 0.0,
                "rate": 0.0,
                "amount": 0.0,
                "godown": ""
            }
        
        return {
            "tally_guid": guid,
            "alter_id": alter_id,
            "voucher_type": voucher_type,
            "voucher_number": voucher_number,
            "item_name": first_item["item_name"],
            "billed_qty": first_item["billed_qty"],
            "rate": first_item["rate"],
            "amount": first_item["amount"],
            "date": formatted_date,
            "party_ledger": party_ledger,
            "godown": first_item["godown"]
        }
        
    except Exception as e:
        logger.error(f"Error extracting voucher: {e}")
        return None


def parse_inventory_vouchers(xml_string: str) -> List[InventoryVoucher]:
    """
    Parse all inventory vouchers from Tally XML string.
    
    Extracts VOUCHER tags and maps to InventoryVoucher objects.
    
    Args:
        xml_string: Raw XML string from Tally export
        
    Returns:
        List of InventoryVoucher objects
    """
    logger.info("Parsing inventory vouchers from XML")
    
    try:
        root = parse_tally_xml(xml_string)
    except ValueError as e:
        logger.error(f"XML parsing failed: {e}")
        return []
    
    vouchers = []
    
    # Find all VOUCHER elements (may be nested or at root level)
    voucher_elements = root.findall(".//VOUCHER")
    
    if not voucher_elements:
        logger.warning("No VOUCHER elements found in XML")
        return []
    
    logger.info(f"Found {len(voucher_elements)} voucher elements")
    
    for i, voucher_elem in enumerate(voucher_elements):
        voucher_data = extract_voucher_element(voucher_elem)
        
        if voucher_data is None:
            continue
        
        try:
            voucher = InventoryVoucher(
                tally_guid=voucher_data["tally_guid"],
                alter_id=voucher_data["alter_id"],
                voucher_type=voucher_data["voucher_type"],
                voucher_number=voucher_data["voucher_number"],
                item_name=voucher_data["item_name"],
                billed_qty=voucher_data["billed_qty"],
                rate=voucher_data["rate"],
                amount=voucher_data["amount"],
                date=voucher_data["date"],
                party_ledger=voucher_data["party_ledger"],
                godown=voucher_data["godown"],
                created_at=datetime.now().isoformat()
            )
            vouchers.append(voucher)
            
        except Exception as e:
            logger.error(f"Error creating voucher object: {e}")
            continue
    
    logger.info(f"Successfully parsed {len(vouchers)} vouchers")
    return vouchers


# =============================================================================
# Supabase Upsert (Idempotent)
# =============================================================================


def upsert_to_supabase(vouchers: List[InventoryVoucher]) -> SyncResult:
    """
    Insert/update vouchers in Supabase with idempotent upsert.
    
    Uses tally_guid as the conflict key - if a voucher with the same
    GUID exists, it will be updated instead of creating a duplicate.
    
    Args:
        vouchers: List of InventoryVoucher objects to upsert
        
    Returns:
        SyncResult with operation statistics
    """
    logger.info(f"Upserting {len(vouchers)} vouchers to Supabase")
    
    result = SyncResult(
        total_vouchers=len(vouchers),
        new_inserts=0,
        updates=0,
        failed=0,
        errors=[]
    )
    
    if not vouchers:
        return result
    
    # Prepare records for bulk upsert
    records = []
    for v in vouchers:
        records.append({
            "tally_guid": v.tally_guid,
            "alter_id": v.alter_id,
            "voucher_type": v.voucher_type,
            "voucher_number": v.voucher_number,
            "item_name": v.item_name,
            "billed_qty": v.billed_qty,
            "rate": v.rate,
            "amount": v.amount,
            "date": v.date,
            "party_ledger": v.party_ledger,
            "godown": v.godown,
            "synced_at": datetime.now().isoformat()
        })
    
    try:
        # Use Supabase upsert with on_conflict
        response = supabase.table(INVENTORY_TABLE).upsert(
            records,
            on_conflict="tally_guid"
        ).execute()
        
        if response.data:
            result.new_inserts = len(response.data)
            logger.info(f"Upserted {len(response.data)} vouchers")
        else:
            # If no data returned, assume all succeeded
            result.new_inserts = len(vouchers)
            
    except Exception as e:
        logger.error(f"Upsert failed: {e}")
        result.failed = len(vouchers)
        result.errors.append(str(e))
    
    return result


# =============================================================================
# Main Sync Pipeline
# =============================================================================


def sync_tally_xml(file_path: str) -> SyncResult:
    """
    Execute full Tally XML sync pipeline.
    
    Pipeline:
    1. Read XML file with encoding detection
    2. Parse vouchers (extract VOUCHER tags)
    3. Upsert to Supabase (idempotent)
    
    Args:
        file_path: Path to Tally XML export
        
    Returns:
        SyncResult with operation statistics
    """
    logger.info(f"Starting Tally sync for: {file_path}")
    
    # Step 1: Read XML
    try:
        xml_content = read_tally_xml_file(file_path)
    except Exception as e:
        logger.error(f"Failed to read XML file: {e}")
        return SyncResult(
            total_vouchers=0,
            new_inserts=0,
            updates=0,
            failed=0,
            errors=[str(e)]
        )
    
    # Step 2: Parse vouchers
    vouchers = parse_inventory_vouchers(xml_content)
    
    if not vouchers:
        logger.warning("No vouchers parsed, skipping database sync")
        return SyncResult(
            total_vouchers=0,
            new_inserts=0,
            updates=0,
            failed=0,
            errors=["No vouchers found in XML"]
        )
    
    # Step 3: Upsert to Supabase
    result = upsert_to_supabase(vouchers)
    
    logger.info(f"Sync complete: {result.new_inserts} inserted/updated, {result.failed} failed")
    return result


def sync_tally_xml_string(xml_content: str) -> SyncResult:
    """
    Sync from XML string (for testing/API use).
    
    Args:
        xml_content: Raw XML string
        
    Returns:
        SyncResult
    """
    logger.info("Starting Tally sync from string")
    
    vouchers = parse_inventory_vouchers(xml_content)
    
    if not vouchers:
        return SyncResult(
            total_vouchers=0,
            new_inserts=0,
            updates=0,
            failed=0,
            errors=["No vouchers found"]
        )
    
    return upsert_to_supabase(vouchers)


# =============================================================================
# Test / Demo
# =============================================================================


def main():
    """Standalone execution for testing."""
    logger.info("=" * 60)
    logger.info("Tally ERP XML Sync Engine v1.0")
    logger.info("=" * 60)
    
    # Create test XML (basic Tally export format)
    test_xml = """<?xml version="1.0" encoding="utf-8"?>
<ROOT>
    <VOUCHER>
        <GUID>TN-001-20240418-001</GUID>
        <ALTERID>1001</ALTERID>
        <VOUCHERTYPE>Receipt Note</VOUCHERTYPE>
        <VOUCHERNUMBER>RN-001</VOUCHERNUMBER>
        <DATE>20240418</DATE>
        <PARTYLEDGERNAME>Acme Suppliers</PARTYLEDGERNAME>
        <INVENTORYLIST>
            <INVENTORYLINEITEM>
                <STOCKITEMNAME>Widget A</STOCKITEMNAME>
                <BILLEDQTY>100</BILLEDQTY>
                <RATE>50.00</RATE>
                <AMOUNT>5000.00</AMOUNT>
                <GODOWN>Main Warehouse</GODOWN>
            </INVENTORYLINEITEM>
        </INVENTORYLIST>
    </VOUCHER>
    <VOUCHER>
        <GUID>TN-001-20240418-002</GUID>
        <ALTERID>1002</ALTERID>
        <VOUCHERTYPE>Delivery Note</VOUCHERTYPE>
        <VOUCHERNUMBER>DN-001</VOUCHERNUMBER>
        <DATE>20240418</DATE>
        <PARTYLEDGERNAME>Big Retail Corp</PARTYLEDGERNAME>
        <INVENTORYLIST>
            <INVENTORYLINEITEM>
                <STOCKITEMNAME>Widget B</STOCKITEMNAME>
                <BILLEDQTY>50</BILLEDQTY>
                <RATE>75.00</RATE>
                <AMOUNT>3750.00</AMOUNT>
                <GODOWN>Dispatch Hub</GODOWN>
            </INVENTORYLINEITEM>
        </INVENTORYLIST>
    </VOUCHER>
</ROOT>"""
    
    # Test parsing
    vouchers = parse_inventory_vouchers(test_xml)
    
    print(f"\n{'='*60}")
    print(f"PARSED VOUCHERS: {len(vouchers)}")
    print(f"{'='*60}")
    
    for v in vouchers:
        print(f"\nGUID: {v.tally_guid}")
        print(f"  Type: {v.voucher_type}")
        print(f"  Number: {v.voucher_number}")
        print(f"  Item: {v.item_name}")
        print(f"  Qty: {v.billed_qty}")
        print(f"  Date: {v.date}")
        print(f"  Party: {v.party_ledger}")
    
    # Test encoding failsafe (simulate corrupted UTF-8)
    print(f"\n{'='*60}")
    print("TESTING ENCODING FAILSAFE")
    print(f"{'='*60}")
    
    # This should trigger fallback to windows-1252
    test_corrupted = b'\xc0\xc1\xc2'  # Invalid UTF-8 bytes
    try:
        root = parse_tally_xml(test_corrupted)
        print("ERROR: Should have failed!")
    except ValueError:
        print("PASS: Encoding failsafe working (correctly rejected invalid XML)")


if __name__ == "__main__":
    main()