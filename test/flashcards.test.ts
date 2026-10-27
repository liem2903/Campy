import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

// UTC keeps the study-day maths readable: the day starts at 04:00Z.
const timeZone = "UTC";
const newCardIntervals = { again: 1, hard: 1, good: 1, easy: 4 };

function getSession(app: App, cookie: string, query: Record<string, string> = { timeZone }) {
  return request(app).get("/api/flashcards").query(query).set("Cookie", cookie);
}
function gradeCard(app: App, questionId: string, body: { grade?: unknown; timeZone?: unknown }, cookie: string) {
  return request(app).post(`/api/flashcards/${questionId}/grade`).set("Cookie", cookie).send(body);
}
async function todaysSession(app: App, cookie: string) {
  const res = await getSession(app, cookie).expect(200);
  return res.body;
}
async function gradedCard(app: App, questionId: string, grade: string, cookie: string) {
  const res = await gradeCard(app, questionId, { grade, timeZone }, cookie).expect(200);
  return res.body;
}
async function createdNote(app: App, cookie: string) {
  const noteId = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id: noteId }).expect(201);
  return noteId;
}
async function addedQuestionId(
  app: App, noteId: string, question: string, cookie: string, tagNames: string[] = [],
): Promise<string> {
  const res = await request(app)
    .post(`/api/notes/${noteId}/questions`)
    .set("Cookie", cookie)
    .send({ question, answer: `Answer to ${question}`, tags: tagNames })
    .expect(201);
  return res.body.id;
}
// GET /api/flashcards with ?tag=…&tag=…, the way the client sends several tags.
async function todaysSessionForTags(app: App, cookie: string, tagIds: string[]) {
  const tagQuery = tagIds.map((tagId) => `&tag=${tagId}`).join("");
  const res = await request(app).get(`/api/flashcards?timeZone=${timeZone}${tagQuery}`).set("Cookie", cookie).expect(200);
  return res.body;
}
async function tagIdNamed(app: App, name: string, cookie: string): Promise<string> {
  const res = await request(app).get("/api/tags").set("Cookie", cookie).expect(200);
  const tag = res.body.find((tagRow: { name: string }) => tagRow.name === name);
  expect(tag).toBeDefined();
  return tag.id;
}
function questionIdsOf(cards: { questionId: string }[]) {
  return cards.map((card) => card.questionId);
}

// Read straight from the DB, so the API can't hide what was saved.
async function storedSchedule(questionId: string) {
  const [schedule] = await sql<{ ease: number; intervalDays: number; dueOn: string; lastGradedOn: string }[]>`
    select ease, interval_days as "intervalDays", due_on::text as "dueOn", last_graded_on::text as "lastGradedOn"
    from questions where id = ${questionId}
  `;
  return schedule;
}

// Only Date is faked, so the DB driver's and Supertest's timers still run. Fake times are in the
// future: sessions get their expiry from Date but the DB checks it against its real now().
function setNow(isoTime: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(isoTime));
}
afterEach(() => {
  vi.useRealTimers();
});

const badTimeZone = { error: "timeZone must be a time zone like Australia/Sydney" };
const badTagFilter = { error: "tag must be up to 50 lowercase tag ids" };
const badGrade = { error: "grade must be again, hard, good or easy" };
const questionNotFound = { error: "Question not found" };
const notUpToday = { error: "That card isn't due today. It may have been graded in another tab" };

describe("the T4a slice", () => {
  it("study a new card with Good, and it comes back the next day", async () => {
    setNow("2027-03-10T12:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "What is a queue?", user.cookie);

    expect(await todaysSession(app, user.cookie)).toEqual({
      cards: [{
        questionId, question: "What is a queue?", answer: "Answer to What is a queue?",
        isNew: true, nextIntervalDays: newCardIntervals,
      }],
      nextDue: null,
      hasAnyQuestions: true,
    });

    await gradedCard(app, questionId, "good", user.cookie);
    expect(await todaysSession(app, user.cookie)).toMatchObject({
      cards: [], nextDue: { daysFromToday: 1, cardCount: 1 },
    });

    setNow("2027-03-11T12:00:00Z");
    expect(questionIdsOf((await todaysSession(app, user.cookie)).cards)).toEqual([questionId]);
  });
});

describe("GET /api/flashcards", () => {
  it("a user with no questions gets no cards and hasAnyQuestions false", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    expect(await todaysSession(app, user.cookie)).toEqual({ cards: [], nextDue: null, hasAnyQuestions: false });
  });

  it("new cards come first, oldest question first, then due cards", async () => {
    setNow("2027-03-10T12:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const reviewedId = await addedQuestionId(app, noteId, "Reviewed", user.cookie);
    await gradedCard(app, reviewedId, "good", user.cookie);
    const olderNewId = await addedQuestionId(app, noteId, "Older new", user.cookie);
    const newerNewId = await addedQuestionId(app, noteId, "Newer new", user.cookie);

    setNow("2027-03-11T12:00:00Z");
    expect(questionIdsOf((await todaysSession(app, user.cookie)).cards)).toEqual([olderNewId, newerNewId, reviewedId]);
  });

  it("shows at most 20 new cards a day; the rest count toward tomorrow", async () => {
    setNow("2027-03-10T12:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionIds: string[] = [];
    for (let i = 1; i <= 21; i++) questionIds.push(await addedQuestionId(app, noteId, `Question ${i}`, user.cookie));

    const firstSession = await todaysSession(app, user.cookie);
    expect(questionIdsOf(firstSession.cards)).toEqual(questionIds.slice(0, 20));
    expect(firstSession.nextDue).toEqual({ daysFromToday: 1, cardCount: 1 });

    // Grading counts against the cap: the 21st card still waits for tomorrow.
    await gradedCard(app, questionIds[0], "good", user.cookie);
    const afterGrade = await todaysSession(app, user.cookie);
    expect(questionIdsOf(afterGrade.cards)).toEqual(questionIds.slice(1, 20));
    expect(afterGrade.nextDue).toEqual({ daysFromToday: 1, cardCount: 2 });
  });

  it("a study day starts at 4 am, so 3 am still counts as the day before", async () => {
    setNow("2027-03-11T03:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "Late night", user.cookie);

    await gradedCard(app, questionId, "good", user.cookie);
    expect(await storedSchedule(questionId)).toMatchObject({ lastGradedOn: "2027-03-10", dueOn: "2027-03-11" });

    setNow("2027-03-11T04:00:00Z");
    expect(questionIdsOf((await todaysSession(app, user.cookie)).cards)).toEqual([questionId]);
  });

  it("doesn't show another user's cards", async () => {
    const app = makeApp();
    const owner = await signedUp(app);
    const otherUser = await signedUp(app);
    const noteId = await createdNote(app, owner.cookie);
    await addedQuestionId(app, noteId, "Mine", owner.cookie);

    expect(await todaysSession(app, otherUser.cookie)).toEqual({ cards: [], nextDue: null, hasAnyQuestions: false });
  });

  it("400 Bad Request when timeZone is missing or unknown", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await getSession(app, user.cookie, {}).expect(400, badTimeZone);
    await getSession(app, user.cookie, { timeZone: "Mars/Olympus" }).expect(400, badTimeZone);
  });

  it("401 Unauthorized without a session", async () => {
    await request(makeApp()).get("/api/flashcards").query({ timeZone }).expect(401);
  });
});

describe("GET /api/flashcards?tag=… (T4b)", () => {
  it("only cards whose question has any of the tags, counts and nextDue included", async () => {
    setNow("2027-03-10T12:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const queueId = await addedQuestionId(app, noteId, "Queue?", user.cookie, ["queue"]);
    const stackId = await addedQuestionId(app, noteId, "Stack?", user.cookie, ["stack"]);
    const untaggedId = await addedQuestionId(app, noteId, "Untagged?", user.cookie);
    const queueTagId = await tagIdNamed(app, "queue", user.cookie);
    const stackTagId = await tagIdNamed(app, "stack", user.cookie);

    expect(questionIdsOf((await todaysSessionForTags(app, user.cookie, [queueTagId])).cards)).toEqual([queueId]);
    expect(questionIdsOf((await todaysSessionForTags(app, user.cookie, [queueTagId, stackTagId])).cards))
      .toEqual([queueId, stackId]);
    expect(questionIdsOf((await todaysSessionForTags(app, user.cookie, [])).cards))
      .toEqual([queueId, stackId, untaggedId]);

    await gradedCard(app, stackId, "easy", user.cookie);
    expect(await todaysSessionForTags(app, user.cookie, [queueTagId]))
      .toMatchObject({ nextDue: null, hasAnyQuestions: true });
    expect(await todaysSessionForTags(app, user.cookie, [stackTagId]))
      .toEqual({ cards: [], nextDue: { daysFromToday: 4, cardCount: 1 }, hasAnyQuestions: true });
  });

  it("hasAnyQuestions is false when no question has the tags, including another user's tag", async () => {
    const app = makeApp();
    const owner = await signedUp(app);
    const otherUser = await signedUp(app);
    const noteId = await createdNote(app, owner.cookie);
    await addedQuestionId(app, noteId, "Mine", owner.cookie, ["queue"]);
    const ownersTagId = await tagIdNamed(app, "queue", owner.cookie);

    expect(await todaysSessionForTags(app, otherUser.cookie, [ownersTagId]))
      .toEqual({ cards: [], nextDue: null, hasAnyQuestions: false });
    expect(await todaysSessionForTags(app, owner.cookie, [randomUUID()]))
      .toEqual({ cards: [], nextDue: null, hasAnyQuestions: false });
  });

  it("the cap of 20 new cards a day counts grades from every session, filtered or not", async () => {
    setNow("2027-03-10T12:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    for (let i = 1; i <= 20; i++) {
      await gradedCard(app, await addedQuestionId(app, noteId, `Untagged ${i}`, user.cookie), "good", user.cookie);
    }
    const queueId = await addedQuestionId(app, noteId, "Queue?", user.cookie, ["queue"]);
    const queueTagId = await tagIdNamed(app, "queue", user.cookie);

    expect(await todaysSessionForTags(app, user.cookie, [queueTagId]))
      .toEqual({ cards: [], nextDue: { daysFromToday: 1, cardCount: 1 }, hasAnyQuestions: true });
    await gradeCard(app, queueId, { grade: "good", timeZone }, user.cookie).expect(409, notUpToday);
  });

  it("400 Bad Request for a malformed tag id or more than 50 tags", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await getSession(app, user.cookie, { timeZone, tag: "not-a-uuid" }).expect(400, badTagFilter);
    const tooManyTags = Array.from({ length: 51 }, () => `&tag=${randomUUID()}`).join("");
    await request(app).get(`/api/flashcards?timeZone=${timeZone}${tooManyTags}`).set("Cookie", user.cookie)
      .expect(400, badTagFilter);
  });
});

describe("POST /api/flashcards/:questionId/grade", () => {
  it("returns the graded card with the next intervals from its new schedule", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "What is a stack?", user.cookie);

    expect(await gradedCard(app, questionId, "good", user.cookie)).toEqual({
      questionId, question: "What is a stack?", answer: "Answer to What is a stack?",
      isNew: false, nextIntervalDays: { again: 1, hard: 1, good: 6, easy: 8 },
    });
    expect(await storedSchedule(questionId)).toMatchObject({ ease: 2.5, intervalDays: 1 });
  });

  it("Again lowers the ease only once per day (T4.3)", async () => {
    setNow("2027-03-10T12:00:00Z");
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "Hard one", user.cookie);

    await gradedCard(app, questionId, "again", user.cookie);
    await gradedCard(app, questionId, "again", user.cookie);
    expect(await storedSchedule(questionId)).toMatchObject({ ease: 2.3, intervalDays: 1, dueOn: "2027-03-11" });

    setNow("2027-03-11T12:00:00Z");
    await gradedCard(app, questionId, "again", user.cookie);
    expect((await storedSchedule(questionId)).ease).toBe(2.1);
  });

  it("409 Conflict when the card was already passed today, and the schedule stays", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "Passed", user.cookie);

    await gradedCard(app, questionId, "good", user.cookie);
    await gradeCard(app, questionId, { grade: "easy", timeZone }, user.cookie).expect(409, notUpToday);
    expect(await storedSchedule(questionId)).toMatchObject({ ease: 2.5, intervalDays: 1 });
  });

  it("a card failed with Again can be graded again the same day", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "Failed once", user.cookie);

    await gradedCard(app, questionId, "again", user.cookie);
    await gradedCard(app, questionId, "good", user.cookie);
    expect(await storedSchedule(questionId)).toMatchObject({ intervalDays: 6 });
    await gradeCard(app, questionId, { grade: "good", timeZone }, user.cookie).expect(409, notUpToday);
  });

  it("two tabs grading the same card at once: one 200 OK, the other 409 Conflict", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "Two tabs", user.cookie);

    const responses = await Promise.all([
      gradeCard(app, questionId, { grade: "easy", timeZone }, user.cookie),
      gradeCard(app, questionId, { grade: "easy", timeZone }, user.cookie),
    ]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect((await storedSchedule(questionId)).ease).toBe(2.65);
  });

  it("409 Conflict for a new card over today's cap of 20", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionIds: string[] = [];
    for (let i = 1; i <= 21; i++) questionIds.push(await addedQuestionId(app, noteId, `Question ${i}`, user.cookie));

    for (const questionId of questionIds.slice(0, 20)) await gradedCard(app, questionId, "good", user.cookie);
    await gradeCard(app, questionIds[20], { grade: "good", timeZone }, user.cookie).expect(409, notUpToday);
  });

  it("400 Bad Request for an unknown grade or time zone", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const questionId = await addedQuestionId(app, noteId, "Q", user.cookie);

    await gradeCard(app, questionId, { grade: "perfect", timeZone }, user.cookie).expect(400, badGrade);
    await gradeCard(app, questionId, { grade: "good" }, user.cookie).expect(400, badTimeZone);
  });

  it("404 Not Found for another user's question, a missing one, or a malformed id", async () => {
    const app = makeApp();
    const owner = await signedUp(app);
    const otherUser = await signedUp(app);
    const noteId = await createdNote(app, owner.cookie);
    const questionId = await addedQuestionId(app, noteId, "Mine", owner.cookie);

    await gradeCard(app, questionId, { grade: "good", timeZone }, otherUser.cookie).expect(404, questionNotFound);
    await gradeCard(app, randomUUID(), { grade: "good", timeZone }, owner.cookie).expect(404, questionNotFound);
    await gradeCard(app, "not-a-uuid", { grade: "good", timeZone }, owner.cookie).expect(404, questionNotFound);
    expect(await todaysSession(app, owner.cookie)).toMatchObject({ cards: [{ questionId, isNew: true }] });
  });
});
