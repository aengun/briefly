import fs from 'fs';
import path from 'path';

export interface Participant {
  id: string;
  team: string;
  name: string;
  speakerId: string; // e.g. "화자A", "참가자1"
}

export interface MeetingSummary {
  asis: string;
  tobe: string;
  expected_effects: string;
  schedule: {
    task: string;
    assignee: string;
    dueDate: string;
  }[];
}

export interface TranscriptUtterance {
  speaker: string;
  text: string;
}

export interface Meeting {
  id: string;
  title: string;
  createdAt: string;
  audioUrl: string;
  participants: Participant[];
  transcript: TranscriptUtterance[];
  summary: MeetingSummary;
}

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

export const getDb = (): { meetings: Meeting[] } => {
  if (!fs.existsSync(DB_PATH)) {
    return { meetings: [] };
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { meetings: [] };
  }
};

export const saveDb = (data: { meetings: Meeting[] }) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

export const saveMeeting = (meeting: Meeting) => {
  const db = getDb();
  db.meetings.unshift(meeting);
  saveDb(db);
};

export const getMeeting = (id: string) => {
  const db = getDb();
  return db.meetings.find((m) => m.id === id) || null;
};
