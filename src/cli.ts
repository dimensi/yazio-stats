import { Command } from "commander";
import "dotenv/config";
import { registerSummaryCommand } from "./commands/summary.js";
import { registerMealsCommand } from "./commands/meals.js";
import { registerWaterCommand } from "./commands/water.js";
import { registerWeightCommand } from "./commands/weight.js";
import { registerExercisesCommand } from "./commands/exercises.js";
import { registerGoalsCommand } from "./commands/goals.js";
import { registerDayCommand } from "./commands/day.js";
import pkg from "../package.json";

const program = new Command();

program
  .name("yazio-stats")
  .description("Extract nutrition statistics from YAZIO")
  .version(pkg.version);

registerSummaryCommand(program);
registerMealsCommand(program);
registerWaterCommand(program);
registerWeightCommand(program);
registerExercisesCommand(program);
registerGoalsCommand(program);
registerDayCommand(program);

program.parse();
