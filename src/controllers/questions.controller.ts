import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { BlockNotInNoteError, NoteNotFoundError, QuestionNotFoundError } from "../errors.js";
import * as questionsService from "../services/questions.service.js";
import type { QuestionFields, QuestionWithTags } from "../services/questions.service.js";
import { INVALID_TAG_NAME, tagNameSchema, uuidPattern } from "./validation.js";

const INVALID_QUESTION = "A question must be 1 to 500 characters";
const INVALID_ANSWER = "An answer must be 1 to 5000 characters";
const INVALID_TAG_LIST = "Tags must be a list of tag names";
const MAX_TAGS_PER_QUESTION = 20;
const TOO_MANY_TAGS = `A question can have at most ${MAX_TAGS_PER_QUESTION} tags`;
const INVALID_BLOCK_ID = "blockId must be a block id or null";

// Checked trimmed, so whitespace alone is refused, but stored as typed: line breaks and indents
// are part of an answer. The length counts characters like Postgres does, and \u0000 is refused
// because Postgres text can't store it.
function cardTextSchema(maxLength: number) {
  return z.string().refine((text) =>
    text.trim() !== "" && [...text].length <= maxLength && !text.includes("\u0000"));
}
const questionTextSchema = cardTextSchema(500);
const answerTextSchema = cardTextSchema(5000);
// Left out = General, so a client from before T2b still works.
const blockIdSchema = z.string().regex(uuidPattern).nullable().default(null);

// GET /api/notes/:id/questions: the note's questions, oldest first.
export async function listOfNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // A non-UUID would make Postgres throw (a 500), so it never reaches the service.
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    const questions = await questionsService.listQuestionsOfNote(req.user!.id, req.params.id); // requireSession set it
    res.json(questions.map(toJson));
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// POST /api/notes/:id/questions { question, answer, tags, blockId }: 201 Created with the new question.
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedBody = questionFieldsFromBody(req.body);
  if ("errorMessage" in parsedBody) {
    res.status(400).json({ error: parsedBody.errorMessage });
    return;
  }
  try {
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    const question = await questionsService.createQuestion(req.user!.id, req.params.id, parsedBody.fields); // requireSession set it
    res.status(201).json(toJson(question));
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// PUT /api/questions/:questionId { question, answer, tags, blockId }: replaces them all and returns
// the question. A card's Save always sends every field; only blockId may be left out (General).
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedBody = questionFieldsFromBody(req.body);
  if ("errorMessage" in parsedBody) {
    res.status(400).json({ error: parsedBody.errorMessage });
    return;
  }
  try {
    if (!uuidPattern.test(req.params.questionId)) throw new QuestionNotFoundError();
    const question = await questionsService.updateQuestion(req.user!.id, req.params.questionId, parsedBody.fields); // requireSession set it
    res.json(toJson(question));
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// DELETE /api/questions/:questionId: deletes the question; its tags stay.
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!uuidPattern.test(req.params.questionId)) throw new QuestionNotFoundError();
    await questionsService.deleteQuestion(req.user!.id, req.params.questionId); // requireSession set it
    res.status(204).end();
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// The card's fields, cleaned up, or the 400 message for the first one that's wrong.
function questionFieldsFromBody(body: unknown): { fields: QuestionFields } | { errorMessage: string } {
  const { question, answer, tags, blockId } = body as {
    question?: unknown; answer?: unknown; tags?: unknown; blockId?: unknown;
  };
  const parsedQuestion = questionTextSchema.safeParse(question);
  if (!parsedQuestion.success) return { errorMessage: INVALID_QUESTION };
  const parsedAnswer = answerTextSchema.safeParse(answer);
  if (!parsedAnswer.success) return { errorMessage: INVALID_ANSWER };
  const parsedTagList = z.array(z.string()).safeParse(tags);
  if (!parsedTagList.success) return { errorMessage: INVALID_TAG_LIST };
  // Every name may create a tag, so an unbounded list could flood the user's Tags page.
  if (parsedTagList.data.length > MAX_TAGS_PER_QUESTION) return { errorMessage: TOO_MANY_TAGS };
  const parsedTagNames = z.array(tagNameSchema).safeParse(parsedTagList.data);
  if (!parsedTagNames.success) return { errorMessage: INVALID_TAG_NAME };
  const parsedBlockId = blockIdSchema.safeParse(blockId);
  if (!parsedBlockId.success) return { errorMessage: INVALID_BLOCK_ID };
  // "Queue" and " queue" are one tag once cleaned up.
  const uniqueTagNames = [...new Set(parsedTagNames.data)];
  return {
    fields: {
      question: parsedQuestion.data, answer: parsedAnswer.data, tagNames: uniqueTagNames, blockId: parsedBlockId.data,
    },
  };
}

// Domain errors → status codes. Anything else goes to the JSON error handler in app.ts.
function sendDomainError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof NoteNotFoundError || err instanceof QuestionNotFoundError) {
    res.status(404).json({ error: err.message });
  } else if (err instanceof BlockNotInNoteError) {
    res.status(400).json({ error: err.message });
  } else {
    next(err);
  }
}

// DB row → API shape: camelCase, and dates as ISO strings.
function toJson(question: QuestionWithTags) {
  return {
    id: question.id,
    noteId: question.note_id,
    blockId: question.block_id,
    blockWasDeleted: question.block_was_deleted,
    question: question.question,
    answer: question.answer,
    tags: question.tags,
    createdAt: question.created_at.toISOString(),
    updatedAt: question.updated_at.toISOString(),
  };
}
