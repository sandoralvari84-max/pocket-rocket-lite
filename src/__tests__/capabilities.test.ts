// The deterministic intent layer is the heart of "the app is the brain": it must detect what the
// user asked for from their own words, reliably, with no model. These tests lock that behaviour.
import { detectCapability } from "../capabilities/dispatch";
import { parseTime, parseDuration } from "../capabilities/registry";

describe("capability detection", () => {
  const cases: [string, string | null][] = [
    ["set a timer for 5 minutes", "set_timer"],
    ["directions to Madrid", "directions"],
    ["text Anna saying I am running late", "draft_message"],
    ["play lofi beats on youtube", "play_youtube"],
    ["google best tapas in Tenerife", "web_search"],
    ["remind me to call the dentist", "add_reminder"],
    ["translate this to spanish", "translate"],
    ["what is the capital of France", null],
    ["hello there, how are you today", null],
  ];
  it.each(cases)("%s -> %s", (input, expected) => {
    const m = detectCapability(input);
    expect(m ? m.id : null).toBe(expected);
  });

  it("extracts the timer duration into slots", () => {
    expect(detectCapability("set a timer for 5 minutes")?.slots.seconds).toBe("300");
  });
  it("extracts the directions destination", () => {
    expect(detectCapability("directions to Madrid")?.slots.destination).toBe("madrid");
  });
  it("is deterministic (same input -> same capability)", () => {
    const a = detectCapability("set a timer for 10 minutes");
    const b = detectCapability("set a timer for 10 minutes");
    expect(a?.id).toBe(b?.id);
  });
});

describe("time parsing", () => {
  it("parses clock times to 24h", () => {
    expect(parseTime("7:30")).toEqual({ h: 7, m: 30 });
    expect(parseTime("7pm")).toEqual({ h: 19, m: 0 });
    expect(parseTime("19:00")).toEqual({ h: 19, m: 0 });
  });
  it("parses colloquial times", () => {
    expect(parseTime("half 7")).toEqual({ h: 7, m: 30 });
    expect(parseTime("quarter to 9")).toEqual({ h: 8, m: 45 });
    expect(parseTime("quarter past 8")).toEqual({ h: 8, m: 15 });
  });
  it("returns null when there's no time", () => {
    expect(parseTime("call mum later")).toBeNull();
  });
});

describe("duration parsing (to seconds)", () => {
  it("parses common durations", () => {
    expect(parseDuration("5 minutes")).toBe(300);
    expect(parseDuration("90 seconds")).toBe(90);
    expect(parseDuration("1 hour 30 minutes")).toBe(5400);
    expect(parseDuration("half an hour")).toBe(1800);
    expect(parseDuration("an hour")).toBe(3600);
  });
  it("returns null when there's no duration", () => {
    expect(parseDuration("remind me about the thing")).toBeNull();
  });
});
