#!/usr/bin/env python3
"""
Rollback ML Model Version
Swaps the active_version tag to a specified older version
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def list_model_versions(supabase, model_type: str = "xgboost") -> list:
    try:
        result = supabase.storage.from_("ml-models").list(path=model_type)
        
        versions = []
        for item in result:
            if item.get('name') and item['name'].startswith('v1_'):
                versions.append(item['name'])
        
        return sorted(versions, reverse=True)
    except Exception as e:
        logger.error(f"Failed to list versions: {e}")
        return []


def get_current_active_version(supabase, model_type: str) -> str:
    try:
        result = supabase.storage.from_("ml-models").download(
            f"{model_type}/v1_latest/metadata.json"
        )
        
        metadata = json.loads(result)
        return metadata.get("version", "unknown")
    except Exception as e:
        logger.warning(f"Could not get active version: {e}")
        return "unknown"


def rollback_version(supabase, model_type: str, target_version: str) -> bool:
    logger.info(f"Rolling back {model_type} to {target_version}")
    
    target_path = f"{model_type}/{target_version}"
    
    try:
        files = supabase.storage.from_("ml-models").list(path=target_path)
        
        if not files:
            logger.error(f"No files found in {target_path}")
            return False
        
        for file in files:
            source = f"{target_path}/{file['name']}"
            dest = f"{model_type}/v1_latest/{file['name']}"
            
            data = supabase.storage.from_("ml-models").download(source)
            
            supabase.storage.from_("ml-models").upload(
                dest,
                data,
                {"upsert": True}
            )
            
            logger.info(f"Copied {source} -> {dest}")
        
        update_metadata = {
            "version": target_version,
            "rolled_back_at": datetime.now().isoformat(),
            "previous_version": get_current_active_version(supabase, model_type),
        }
        
        supabase.storage.from_("ml-models").upload(
            f"{model_type}/v1_latest/metadata.json",
            json.dumps(update_metadata),
            {"upsert": True}
        )
        
        log_rollback(supabase, model_type, target_version)
        
        logger.info(f"Successfully rolled back {model_type} to {target_version}")
        return True
        
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        return False


def log_rollback(supabase, model_type: str, target_version: str):
    try:
        supabase.table("model_training_logs").insert({
            "model_type": model_type,
            "event": "rollback",
            "target_version": target_version,
            "timestamp": datetime.now().isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"Could not log rollback: {e}")


def show_versions(supabase):
    for model_type in ["xgboost", "tft"]:
        print(f"\n=== {model_type.upper()} Versions ===")
        
        versions = list_model_versions(supabase, model_type)
        
        if not versions:
            print(f"  No versions found")
            continue
        
        current = get_current_active_version(supabase, model_type)
        
        for v in versions:
            marker = " <- CURRENT" if v == current else ""
            print(f"  {v}{marker}")


def main():
    parser = argparse.ArgumentParser(description="Rollback ML Model")
    parser.add_argument("--model", default="xgboost", choices=["xgboost", "tft", "all"])
    parser.add_argument("--target", required=True, help="Target version (e.g., v1_2026_04_15)")
    parser.add_argument("--list", action="store_true", help="List available versions")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation")
    
    args = parser.parse_args()
    
    supabase = get_supabase_client()
    
    if args.list:
        show_versions(supabase)
        return
    
    if args.target == "previous":
        versions = list_model_versions(supabase, args.model)
        if len(versions) > 1:
            args.target = versions[1]
        else:
            logger.error("No previous version available")
            sys.exit(1)
    
    if not args.confirm:
        response = input(f"Rollback {args.model} to {args.target}? [y/N]: ")
        if response.lower() != 'y':
            print("Aborted")
            sys.exit(0)
    
    if args.model == "all":
        for model_type in ["xgboost", "tft"]:
            success = rollback_version(supabase, model_type, args.target)
            if not success:
                sys.exit(1)
    else:
        success = rollback_version(supabase, args.model, args.target)
        if not success:
            sys.exit(1)


if __name__ == "__main__":
    main()