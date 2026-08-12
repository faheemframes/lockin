const ACHIEVEMENTS = [
  // Session Milestones
  {
    id: "first_mission",
    title: "First Mission",
    description: "Completed your first focus run.",
    icon: "target",
    check: (stats) => stats.totalMissions >= 1
  },
  {
    id: "first_3_hour_session",
    title: "Deep Focus (3H)",
    description: "Locked in for at least 3 hours in a single session.",
    icon: "battery-charging",
    check: (stats) => stats.maxSessionMinutes >= 180
  },
  {
    id: "first_5_hour_session",
    title: "Elite Focus (5H)",
    description: "Locked in for at least 5 hours in a single session.",
    icon: "zap",
    check: (stats) => stats.maxSessionMinutes >= 300
  },
  {
    id: "first_8_hour_session",
    title: "Monk Mode (8H)",
    description: "Locked in for at least 8 hours in a single session.",
    icon: "crown",
    check: (stats) => stats.maxSessionMinutes >= 480
  },

  // Focus Milestones
  {
    id: "10_hour_week",
    title: "10 Hour Week",
    description: "Focused for 10 hours or more in the last 7 days.",
    icon: "activity",
    check: (stats) => stats.weeklyFocusMinutes >= 600
  },
  {
    id: "25_hour_week",
    title: "25 Hour Week",
    description: "Focused for 25 hours or more in the last 7 days.",
    icon: "flame",
    check: (stats) => stats.weeklyFocusMinutes >= 1500
  },
  {
    id: "50_hour_month",
    title: "50 Hour Month",
    description: "Focused for 50 hours or more in the last 30 days.",
    icon: "calendar",
    check: (stats) => stats.monthlyFocusMinutes >= 3000
  },

  // Streak Milestones
  {
    id: "streak_7_day",
    title: "7 Day Streak",
    description: "Maintained a 7-day focus streak.",
    icon: "award",
    check: (stats) => stats.currentStreak >= 7
  },
  {
    id: "streak_14_day",
    title: "14 Day Streak",
    description: "Maintained a 14-day focus streak.",
    icon: "shield-alert",
    check: (stats) => stats.currentStreak >= 14
  },
  {
    id: "streak_30_day",
    title: "30 Day Streak",
    description: "Maintained a 30-day focus streak.",
    icon: "sparkles",
    check: (stats) => stats.currentStreak >= 30
  },
  {
    id: "streak_100_day",
    title: "Consistency God",
    description: "Maintained a 100-day focus streak.",
    icon: "trophy",
    check: (stats) => stats.currentStreak >= 100
  },

  // Task Milestones
  {
    id: "tasks_25",
    title: "25 Tasks Done",
    description: "Completed 25 tasks in focus runs.",
    icon: "check-circle",
    check: (stats) => stats.totalTasksCompleted >= 25
  },
  {
    id: "tasks_100",
    title: "100 Tasks Done",
    description: "Completed 100 tasks in focus runs.",
    icon: "clipboard-list",
    check: (stats) => stats.totalTasksCompleted >= 100
  },
  {
    id: "tasks_500",
    title: "Productivity Master",
    description: "Completed 500 tasks in focus runs.",
    icon: "gift",
    check: (stats) => stats.totalTasksCompleted >= 500
  },

  // Mission Milestones
  {
    id: "mission_master",
    title: "Mission Master",
    description: "Completed 10 focus runs.",
    icon: "medal",
    check: (stats) => stats.totalMissions >= 10
  },
  {
    id: "veteran",
    title: "LOCKIN Veteran",
    description: "Completed 50 focus runs.",
    icon: "swords",
    check: (stats) => stats.totalMissions >= 50
  },

  // Team Milestones
  {
    id: "top_contributor",
    title: "Top Contributor",
    description: "Achieved #1 rank in a completed focus mission.",
    icon: "user-check",
    check: (stats) => stats.rank === 1
  },
  {
    id: "team_mvp",
    title: "Team MVP",
    description: "Ranked #1 in a group mission of more than 1 participant.",
    icon: "users",
    check: (stats) => stats.rank === 1 && stats.participantCount > 1
  }
];

function checkAchievements(stats) {
  return ACHIEVEMENTS.filter(achievement => achievement.check(stats)).map(a => ({
    id: a.id,
    title: a.title,
    description: a.description,
    icon: a.icon
  }));
}

module.exports = {
  ACHIEVEMENTS,
  checkAchievements
};
