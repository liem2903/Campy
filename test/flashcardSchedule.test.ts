import { describe, expect, it } from "vitest";
import {
  type CardSchedule,
  nextIntervalDaysForEveryGrade,
  scheduleAfterGrade,
} from "../src/services/flashcardSchedule.js";

const newCard: CardSchedule = { ease: 2.5, intervalDays: 0, isNew: true, wasGradedToday: false };
const oneDayCard: CardSchedule = { ease: 2.5, intervalDays: 1, isNew: false, wasGradedToday: false };
const sixDayCard: CardSchedule = { ease: 2.5, intervalDays: 6, isNew: false, wasGradedToday: false };

describe("flashcard schedule (SM-2)", () => {
  it("gives a new card 1/1/1/4 days", () => {
    expect(nextIntervalDaysForEveryGrade(newCard)).toEqual({ again: 1, hard: 1, good: 1, easy: 4 });
  });

  it("goes from 1 day to 3 on Good, and Easy beats Good", () => {
    expect(nextIntervalDaysForEveryGrade(oneDayCard)).toEqual({ again: 1, hard: 1, good: 3, easy: 4 });
  });

  it("multiplies a 6-day interval: Hard ×1.2, Good ×ease, Easy ×ease ×1.3", () => {
    expect(nextIntervalDaysForEveryGrade(sixDayCard)).toEqual({ again: 1, hard: 7, good: 15, easy: 20 });
  });

  it("resets to 1 day and lowers the ease on Again", () => {
    expect(scheduleAfterGrade(sixDayCard, "again")).toEqual({ ease: 2.3, intervalDays: 1 });
  });

  it("lowers the ease on Again only once per day", () => {
    const gradedTodayCard = { ...sixDayCard, wasGradedToday: true };
    expect(scheduleAfterGrade(gradedTodayCard, "again")).toEqual({ ease: 2.5, intervalDays: 1 });
  });

  it("never lets the ease drop below 1.3", () => {
    expect(scheduleAfterGrade({ ...sixDayCard, ease: 1.35 }, "again").ease).toBe(1.3);
  });

  it("counts every grade: a new card graded Again then Good is due in 3 days", () => {
    const afterAgain = scheduleAfterGrade(newCard, "again");
    const afterGood = scheduleAfterGrade({ ...afterAgain, isNew: false, wasGradedToday: true }, "good");
    expect(afterGood.intervalDays).toBe(3);
  });

  it("never schedules a card more than 100 years out", () => {
    expect(scheduleAfterGrade({ ...sixDayCard, intervalDays: 30000 }, "easy").intervalDays).toBe(36500);
  });

  it("rounds the ease to 2 decimals", () => {
    expect(scheduleAfterGrade(sixDayCard, "hard").ease).toBe(2.35);
  });
});
