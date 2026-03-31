export interface AdminKpis {
  totalUsers: number;
  usersLast7Days: number;
  totalDocuments: number;
  totalProblemSolverSessions: number;
  feedbackTotal: number;
  feedbackNew: number;
}

export interface ActivityPoint {
  date: string;
  documents: number;
  problemSolverSessions: number;
}

export interface ActivityResponse {
  range: "7d" | "30d";
  points: ActivityPoint[];
}
