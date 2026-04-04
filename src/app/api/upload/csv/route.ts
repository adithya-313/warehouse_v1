import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are accepted" }, { status: 400 });
    }

    const buffer    = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "..", "python");

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, "fallback.csv"), buffer);

    return NextResponse.json({
      message:  "CSV uploaded successfully — it will be used on next sync",
      filename: file.name,
      size:     buffer.length,
    });
  } catch (err) {
    console.error("[upload/csv]", err);
    return NextResponse.json({ error: "CSV upload failed" }, { status: 500 });
  }
}
