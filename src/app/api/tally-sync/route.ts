import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { spawn } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Parse request body
    const body = await req.json();
    const { file_path } = body;

    if (!file_path) {
      return NextResponse.json(
        { error: "file_path is required" },
        { status: 400 }
      );
    }

    // Validate file exists in storage
    const fileName = file_path.split("/").pop();
    if (!fileName) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    // Trigger Python sync worker
    // In V2, this would be a message queue trigger
    const pythonScript = "python";
    const scriptArgs = [
      "python/tally_sync_engine.py",
      "--file-url",
      file_path,
    ];

    console.log("[tally-sync] Spawning:", pythonScript, scriptArgs.join(" "));

    let stdout = "";
    let stderr = "";

    try {
      const child = spawn(pythonScript, scriptArgs, {
        shell: true,
      });

      // Wait for process with timeout (5 minutes max)
      const result = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error("Sync timeout after 5 minutes"));
        }, 5 * 60 * 1000);

        child.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        child.on("close", (code: number | null) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve(code || 0);
          } else {
            reject(new Error(`Process exited with code ${code}`));
          }
        });

        child.on("error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      console.log("[tally-sync] Completed successfully");
      console.log("[tally-sync] stdout:", stdout.slice(-500));

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      console.error("[tally-sync] Error:", errorMessage);
      
      // Check if it's a partial success (some batches completed)
      if (stdout.includes("Upserted batch")) {
        // Parse partial results from stdout
        const totalMatch = stdout.match(/total_vouchers:\s*(\d+)/);
        const newMatch = stdout.match(/new_inserts:\s*(\d+)/);
        
        return NextResponse.json({
          total_vouchers: totalMatch ? parseInt(totalMatch[1], 10) : 0,
          new_inserts: newMatch ? parseInt(newMatch[1], 10) : 0,
          updates: 0,
          failed: 0,
          partial: true,
          warning: "Some batches may have failed",
        });
      }
      
      return NextResponse.json(
        { error: errorMessage, details: stderr.slice(-500) },
        { status: 500 }
      );
    }

    // Parse results from stdout
    const totalMatch = stdout.match(/total_vouchers:\s*(\d+)/);
    const newMatch = stdout.match(/new_inserts:\s*(\d+)/);
    const failedMatch = stdout.match(/failed:\s*(\d+)/);

    const result = {
      total_vouchers: totalMatch ? parseInt(totalMatch[1], 10) : 0,
      new_inserts: newMatch ? parseInt(newMatch[1], 10) : 0,
      updates: 0,
      failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
    };

    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[tally-sync] API error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}