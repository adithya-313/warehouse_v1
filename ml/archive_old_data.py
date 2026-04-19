import os
import json
import logging
import gzip
import shutil
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

ARCHIVE_OLDER_THAN_DAYS = 365
BATCH_SIZE = 10000


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_old_movements(supabase, before_date: str, limit: int = BATCH_SIZE):
    result = supabase.table("stock_movements").select(
        "id, product_id, quantity_change, movement_type, metadata, warehouse_id, note, date, created_at"
    ).lte("created_at", before_date).order("created_at").limit(limit).execute()
    
    return result.data or []


def export_to_parquet(df: pd.DataFrame, path: str):
    df.to_parquet(path, compression='gzip', index=False)
    
    file_size = os.path.getsize(path)
    logger.info(f"Exported {len(df)} rows to {path} ({file_size / 1024 / 1024:.2f} MB)")
    
    return path


def upload_to_storage(supabase, local_path: str, remote_path: str):
    try:
        with open(local_path, 'rb') as f:
            data = f.read()
        
        supabase.storage.from_("training-data").upload(
            remote_path,
            data,
            {"content-type": "application/octet-stream", "upsert": True}
        )
        
        logger.info(f"Uploaded to {remote_path}")
        return True
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return False


def compress_file(input_path: str) -> str:
    output_path = input_path + '.gz'
    
    with open(input_path, 'rb') as f_in:
        with gzip.open(output_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    logger.info(f"Compressed {input_path} -> {output_path}")
    return output_path


def delete_archived_movements(supabase, ids: list):
    if not ids:
        return
    
    for batch in [ids[i:i + 1000] for i in range(0, len(ids), 1000)]:
        try:
            for id in batch:
                supabase.table("stock_movements").delete().eq("id", id).execute()
        except Exception as e:
            logger.warning(f"Delete batch failed: {e}")


def archive_old_data(months_to_keep: int = 12):
    logger.info("=" * 50)
    logger.info("Starting Archive Process")
    logger.info("=" * 50)
    
    supabase = get_supabase_client()
    
    months_to_keep_date = datetime.now() - timedelta(days=months_to_keep * 30)
    archive_before = months_to_keep_date.strftime('%Y-%m-%d')
    
    logger.info(f"Archiving movements before {archive_before}")
    
    total_archived = 0
    batch_num = 0
    
    all_ids = []
    temp_dir = Path("/tmp/archive")
    temp_dir.mkdir(exist_ok=True)
    
    while True:
        movements = get_old_movements(supabase, archive_before, BATCH_SIZE)
        
        if not movements:
            break
        
        df = pd.DataFrame(movements)
        
        batch_num += 1
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        local_path = temp_dir / f"stock_movements_{timestamp}_batch{batch_num}.parquet"
        
        export_to_parquet(df, str(local_path))
        
        compressed = compress_file(str(local_path))
        
        year_month = months_to_keep_date.strftime('%Y_%m')
        remote_path = f"archive/{year_month}/stock_movements_{timestamp}_batch{batch_num}.parquet.gz"
        
        upload_to_storage(supabase, compressed, remote_path)
        
        all_ids.extend([m['id'] for m in movements])
        total_archived += len(movements)
        
        logger.info(f"Batch {batch_num}: {len(movements)} rows archived")
    
    if all_ids:
        logger.info(f"Deleting {len(all_ids)} archived movements...")
        delete_archived_movements(supabase, all_ids)
    
    temp_dir_clean = temp_dir / "*.parquet*"
    for f in temp_dir.glob("*"):
        f.unlink()
    
    result = {
        "total_archived": total_archived,
        "batches": batch_num,
        "archive_date": datetime.now().isoformat(),
        "archived_before": archive_before,
    }
    
    try:
        supabase.table("archive_logs").insert({
            "archived_at": datetime.now().isoformat(),
            "records_archived": total_archived,
            "batches": batch_num,
            "date_range": f"before {archive_before}",
        }).execute()
    except Exception as e:
        logger.warning(f"Could not log to archive_logs: {e}")
    
    logger.info(f"Archive complete: {json.dumps(result, indent=2)}")
    
    return result


def cleanup_old_partitions():
    logger.info("Cleaning up old partitions...")
    
    supabase = get_supabase_client()
    
    cutoff_date = datetime.now() - timedelta(days=ARCHIVE_OLDER_THAN_DAYS + 30)
    
    partitions = supabase.query("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'stock_movements_%'
    """).execute()
    
    logger.info(f"Found {len(partitions.data or [])} partitions")


def run_maintenance():
    logger.info("Running maintenance...")
    
    result = archive_old_data()
    
    logger.info("Maintenance complete!")
    
    return result


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "cleanup":
            cleanup_old_partitions()
        elif sys.argv[1] == "maintenance":
            run_maintenance()
    else:
        result = archive_old_data()
        print(json.dumps(result, indent=2))