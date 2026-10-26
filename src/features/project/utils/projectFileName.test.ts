import { describe, expect, it } from "vitest";
import { projectFileName } from "@/features/project/utils/projectFileName";

describe("projectFileName", () => {
  it("uses the project name with the .layoutry extension", () => {
    expect(projectFileName("Landing page")).toBe("Landing page.layoutry");
  });

  it("replaces characters that are invalid in Windows, macOS or Linux file names", () => {
    expect(projectFileName('a<b>c:d"e/f\\g|h?i*j')).toBe(
      "a-b-c-d-e-f-g-h-i-j.layoutry",
    );
  });

  it("removes leading/trailing dots and spaces, which Windows drops or Unix hides", () => {
    expect(projectFileName(" ..My project.. ")).toBe("My project.layoutry");
  });

  it("never produces a Windows device name", () => {
    expect(projectFileName("CON")).toBe("CON-project.layoutry");
    expect(projectFileName("lpt1")).toBe("lpt1-project.layoutry");
    expect(projectFileName("Console")).toBe("Console.layoutry");
  });

  it("falls back to the default name when nothing usable is left", () => {
    expect(projectFileName("...")).toBe("Untitled Project.layoutry");
    expect(projectFileName("\u0000\u0001")).toBe("Untitled Project.layoutry");
  });

  it("limits very long names without splitting a character", () => {
    const name = projectFileName("😀".repeat(150));
    expect(name).toBe(`${"😀".repeat(100)}.layoutry`);
  });

  it("keeps non-Latin names", () => {
    expect(projectFileName("Проект 日本")).toBe("Проект 日本.layoutry");
  });
});
