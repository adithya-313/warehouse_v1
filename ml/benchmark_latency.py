import asyncio
import aiohttp
import time
import statistics
from datetime import datetime
from typing import List, Dict
import argparse


BASE_URL = "http://localhost:8080"
CONCURRENT_REQUESTS = 100


async def make_request(session: aiohttp.ClientSession, product_id: str) -> float:
    start = time.perf_counter()
    
    try:
        async with session.post(
            f"{BASE_URL}/predict",
            json={"product_id": product_id},
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            await response.json()
            elapsed = time.perf_counter() - start
            return elapsed
    except Exception as e:
        print(f"Error: {e}")
        return -1


async def benchmark_concurrent(product_ids: List[str], num_requests: int = 100) -> Dict:
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(num_requests):
            product_id = product_ids[i % len(product_ids)]
            tasks.append(make_request(session, product_id))
        
        results = await asyncio.gather(*tasks)
    
    valid_results = [r for r in results if r > 0]
    
    if not valid_results:
        return {
            "error": "All requests failed",
            "total": num_requests,
            "successful": 0,
        }
    
    latencies_ms = [r * 1000 for r in valid_results]
    
    return {
        "total_requests": num_requests,
        "successful": len(valid_results),
        "failed": num_requests - len(valid_results),
        "min_ms": min(latencies_ms),
        "max_ms": max(latencies_ms),
        "avg_ms": statistics.mean(latencies_ms),
        "median_ms": statistics.median(latencies_ms),
        "p95_ms": sorted(latencies_ms)[int(len(latencies_ms) * 0.95)] if len(latencies_ms) >= 20 else max(latencies_ms),
        "p99_ms": sorted(latencies_ms)[int(len(latencies_ms) * 0.99)] if len(latencies_ms) >= 100 else max(latencies_ms),
    }


async def benchmark_sequential(product_ids: List[str], num_requests: int = 100) -> Dict:
    latencies_ms = []
    
    async with aiohttp.ClientSession() as session:
        for i in range(num_requests):
            product_id = product_ids[i % len(product_ids)]
            elapsed = await make_request(session, product_id)
            if elapsed > 0:
                latencies_ms.append(elapsed * 1000)
    
    if not latencies_ms:
        return {"error": "All requests failed"}
    
    return {
        "total_requests": num_requests,
        "successful": len(latencies_ms),
        "failed": num_requests - len(latencies_ms),
        "min_ms": min(latencies_ms),
        "max_ms": max(latencies_ms),
        "avg_ms": statistics.mean(latencies_ms),
        "median_ms": statistics.median(latencies_ms),
        "p95_ms": sorted(latencies_ms)[int(len(latencies_ms) * 0.95)],
    }


async def warm_up(session: aiohttp.ClientSession, product_id: str, count: int = 5):
    print(f"Warming up with {count} requests...")
    for _ in range(count):
        await make_request(session, product_id)
    print("Warm up complete")


async def run_benchmark(mode: str = "concurrent", num_requests: int = 100):
    product_ids = [
        "a1000000-0000-0000-0000-000000000001",
        "a1000000-0000-0000-0000-000000000002",
        "a1000000-0000-0000-0000-000000000003",
    ]
    
    print(f"=== ML Service Benchmark ===")
    print(f"Mode: {mode}")
    print(f"Requests: {num_requests}")
    print(f"Target: {BASE_URL}")
    print()
    
    start_time = time.perf_counter()
    
    async with aiohttp.ClientSession() as session:
        await warm_up(session, product_ids[0], 3)
    
    if mode == "concurrent":
        results = await benchmark_concurrent(product_ids, num_requests)
    else:
        results = await benchmark_sequential(product_ids, num_requests)
    
    end_time = time.perf_counter()
    total_time = end_time - start_time
    
    print(f"\n=== Results ===")
    print(f"Total Time: {total_time:.2f}s")
    print(f"Requests: {results.get('total_requests', 'N/A')}")
    print(f"Successful: {results.get('successful', 'N/A')}")
    print(f"Failed: {results.get('failed', 'N/A')}")
    print()
    print(f"Latency (ms):")
    print(f"  Min:    {results.get('min_ms', 'N/A'):.2f}")
    print(f"  Max:    {results.get('max_ms', 'N/A'):.2f}")
    print(f"  Avg:    {results.get('avg_ms', 'N/A'):.2f}")
    print(f"  Median: {results.get('median_ms', 'N/A'):.2f}")
    print(f"  p95:   {results.get('p95_ms', 'N/A'):.2f}")
    print(f"  p99:   {results.get('p99_ms', 'N/A'):.2f}")
    
    if results.get("successful", 0) > 0:
        rps = results["successful"] / total_time
        print(f"\nThroughput: {rps:.2f} req/s")
    
    return results


async def test_health():
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/health") as resp:
                data = await resp.json()
                print(f"Health: {data}")
                return data.get("status") == "healthy"
        except Exception as e:
            print(f"Health check failed: {e}")
            return False


def main():
    import sys
    
    parser = argparse.ArgumentParser(description="Benchmark ML Service")
    parser.add_argument("--mode", choices=["concurrent", "sequential"], default="concurrent")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--health", action="store_true", help="Run health check only")
    parser.add_argument("--url", default="http://localhost:8080")
    
    args = parser.parse_args()
    
    global BASE_URL
    BASE_URL = args.url
    
    if args.health:
        result = asyncio.run(test_health())
        sys.exit(0 if result else 1)
    
    result = asyncio.run(run_benchmark(args.mode, args.requests))
    
    if "error" in result and result["successful"] == 0:
        sys.exit(1)
    
    sys.exit(0)


if __name__ == "__main__":
    main()