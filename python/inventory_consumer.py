import os
import json
import time
from datetime import datetime

import redis
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL")
REDIS_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

STREAM_NAME = "stream:warehouse:picks"
CONSUMER_GROUP = "cg:inventory:processors"
CONSUMER_NAME = f"worker-{os.getenv('HOSTNAME', 'local')}-{os.getpid()}"

BATCH_SIZE = 10
BLOCK_TIMEOUT_MS = 5000
MAX_RETRIES = 3


def get_redis_client() -> redis.Redis:
    return redis.Redis.from_url(REDIS_REST_URL, token=REDIS_TOKEN)


def ensure_consumer_group(redis_client: redis.Redis):
    try:
        redis_client.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id="0", mkstream=True)
        print(f"[Init] Created consumer group: {CONSUMER_GROUP}")
    except redis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            print(f"[Init] Consumer group already exists: {CONSUMER_GROUP}")
        else:
            raise


def process_pick_event(event: dict) -> bool:
    payload = json.loads(event["payload"])
    
    batch_id = payload["batch_id"]
    item_id = payload["item_id"]
    quantity = int(payload["quantity"])
    worker_id = payload["worker_id"]
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        item_response = supabase.table("pick_batch_items").select(
            "requested_qty, product_id, bin_location_id"
        ).eq("id", item_id).single()
        
        if item_response.data is None:
            print(f"[Error] Item not found: {item_id}")
            return False
        
        requested_qty = item_response.data["requested_qty"]
        product_id = item_response.data["product_id"]
        bin_location_id = item_response.data["bin_location_id"]
        
        new_status = "picked" if quantity >= requested_qty else "pending"
        
        update_response = supabase.table("pick_batch_items").update({
            "picked_qty": quantity,
            "status": new_status,
            "picked_by": worker_id,
            "picked_at": datetime.utcnow().isoformat(),
        }).eq("id", item_id).execute()
        
        if hasattr(update_response, 'error') and update_response.error:
            raise Exception(update_response.error)
        
        if product_id and bin_location_id:
            inventory_response = supabase.table("inventory").select(
                "quantity, reserved_qty"
            ).eq("product_id", product_id).eq("bin_location_id", bin_location_id).single()
            
            if inventory_response.data:
                current_qty = inventory_response.data["quantity"] or 0
                reserved_qty = inventory_response.data["reserved_qty"] or 0
                
                new_qty = max(0, current_qty - quantity)
                new_reserved = max(0, reserved_qty - quantity)
                
                supabase.table("inventory").update({
                    "quantity": new_qty,
                    "reserved_qty": new_reserved,
                    "updated_at": datetime.utcnow().isoformat(),
                }).eq("product_id", product_id).eq("bin_location_id", bin_location_id).execute()
        
        supabase.table("pick_audit_log").insert({
            "pick_batch_id": batch_id,
            "pick_item_id": item_id,
            "action": "item_picked",
            "performed_by": worker_id,
            "details": json.dumps({"picked_qty": quantity, "new_status": new_status}),
        }).execute()
        
        if new_status == "picked":
            all_items_response = supabase.table("pick_batch_items").select(
                "status"
            ).eq("pick_batch_id", batch_id).execute()
            
            picked_count = sum(
                1 for i in (all_items_response.data or [])
                if i["status"] in ["picked", "verified"]
            )
            
            supabase.table("pick_batches").update({
                "total_picks_completed": picked_count,
            }).eq("id", batch_id).execute()
        
        print(f"[Processed] Item {item_id} from batch {batch_id} - qty: {quantity}")
        return True
        
    except Exception as e:
        print(f"[Error] Failed to process event: {e}")
        return False


def run_consumer():
    redis_client = get_redis_client()
    
    ensure_consumer_group(redis_client)
    
    print(f"[Consumer] Started: {CONSUMER_NAME}")
    print(f"[Consumer] Listening on stream: {STREAM_NAME}")
    
    while True:
        try:
            messages = redis_client.xreadgroup(
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams={STREAM_NAME: ">"},
                count=BATCH_SIZE,
                block=BLOCK_TIMEOUT_MS,
            )
            
            if not messages:
                continue
            
            for stream, entries in messages:
                for message_id, fields in entries:
                    event = fields
                    success = False
                    
                    for attempt in range(MAX_RETRIES):
                        try:
                            success = process_pick_event({"id": message_id, **event})
                            if success:
                                break
                        except Exception as e:
                            print(f"[Retry] Attempt {attempt + 1} failed: {e}")
                            time.sleep(1)
                    
                    if success:
                        redis_client.xack(STREAM_NAME, CONSUMER_GROUP, message_id)
                        print(f"[Acked] Message {message_id}")
                    else:
                        print(f"[Nack] Message {message_id} - will retry on next claim")
                        
        except Exception as e:
            print(f"[Fatal] Consumer error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    if not REDIS_REST_URL or not REDIS_TOKEN:
        print("[Error] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set")
        exit(1)
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[Error] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        exit(1)
    
    run_consumer()