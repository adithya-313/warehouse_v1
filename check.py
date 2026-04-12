import os
import glob

api_dir = r"c:\Users\sinne\Downloads\warehouse_v1\warehouse_v1\src\app\api"
routes = glob.glob(f"{api_dir}\\**\\*.ts", recursive=True)

missing_try = []
has_stock_levels = []

for filepath in routes:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
        if "try {" not in content and "try{" not in content:
            missing_try.append(os.path.relpath(filepath, api_dir))
        
        if "stock_level" in content.lower():
            has_stock_levels.append(os.path.relpath(filepath, api_dir))

print(f"Total Routes: {len(routes)}")
print(f"Missing Try-Catch ({len(missing_try)}):")
for m in missing_try:
    print(" -", m)

print(f"\nHas 'stock_levels' table ref ({len(has_stock_levels)}):")
for s in has_stock_levels:
    print(" -", s)
