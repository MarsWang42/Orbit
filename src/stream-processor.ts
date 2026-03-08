export interface StreamCallbacks {
  onInit: (sessionId: string) => void;
  onText: (text: string) => void;
  onToolUse: (name: string, input: Record<string, any>) => void;
  onToolResult: (name: string) => void;
  onResult: (status: string, durationMs: number) => void;
  onError: (error: string) => void;
}

export class StreamProcessor {
  private buffer = "";
  private callbacks: StreamCallbacks;

  constructor(callbacks: StreamCallbacks) {
    this.callbacks = callbacks;
  }

  feed(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.parseLine(trimmed);
    }
  }

  flush() {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer.trim());
      this.buffer = "";
    }
  }

  private parseLine(line: string) {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      return;
    }

    switch (obj.type) {
      case "system":
        if (obj.session_id) {
          this.callbacks.onInit(obj.session_id);
        }
        break;

      case "assistant":
        if (obj.message?.content && Array.isArray(obj.message.content)) {
          for (const block of obj.message.content) {
            if (block.type === "text" && typeof block.text === "string") {
              this.callbacks.onText(block.text);
            } else if (block.type === "tool_use") {
              this.callbacks.onToolUse(block.name ?? "unknown", block.input ?? {});
            } else if (block.type === "tool_result") {
              this.callbacks.onToolResult(block.name ?? "unknown");
            }
          }
        }
        break;

      case "result":
        this.callbacks.onResult(
          obj.subtype ?? "unknown",
          obj.duration_ms ?? 0,
        );
        break;

      case "error":
        this.callbacks.onError(obj.error?.message ?? JSON.stringify(obj));
        break;
    }
  }
}
