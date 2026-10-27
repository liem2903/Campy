import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { QuestionNotFoundError } from "../errors.js";
import * as flashcardsService from "../services/flashcards.service.js";
import { FLASHCARD_GRADES } from "../services/flashcards.service.js";
import { uuidPattern } from "./validation.js";

const INVALID_TIME_ZONE = "timeZone must be a time zone like Australia/Sydney";
const INVALID_GRADE = "grade must be again, hard, good or easy";

// A zone Intl knows. Intl throws a RangeError for anything else.
const timeZoneSchema = z.string().max(100).refine((timeZone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
});
const gradeSchema = z.enum(FLASHCARD_GRADES);

// GET /api/flashcards?timeZone=…: today's cards, the next due day, and whether the user has any questions.
export async function getTodaysSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedTimeZone = timeZoneSchema.safeParse(req.query.timeZone);
  if (!parsedTimeZone.success) {
    res.status(400).json({ error: INVALID_TIME_ZONE });
    return;
  }
  try {
    res.json(await flashcardsService.getTodaysSession(req.user!.id, parsedTimeZone.data)); // requireSession set it
  } catch (err) {
    next(err);
  }
}

// POST /api/flashcards/:questionId/grade { grade, timeZone }: 200 OK with the card as it now is.
export async function gradeCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as { grade?: unknown; timeZone?: unknown };
  const parsedGrade = gradeSchema.safeParse(body.grade);
  if (!parsedGrade.success) {
    res.status(400).json({ error: INVALID_GRADE });
    return;
  }
  const parsedTimeZone = timeZoneSchema.safeParse(body.timeZone);
  if (!parsedTimeZone.success) {
    res.status(400).json({ error: INVALID_TIME_ZONE });
    return;
  }
  try {
    if (!uuidPattern.test(req.params.questionId)) throw new QuestionNotFoundError();
    const gradedCard = await flashcardsService.gradeFlashcard(
      req.user!.id, req.params.questionId, parsedGrade.data, parsedTimeZone.data, // requireSession set it
    );
    res.json(gradedCard);
  } catch (err) {
    if (err instanceof QuestionNotFoundError) res.status(404).json({ error: err.message });
    else next(err);
  }
}
