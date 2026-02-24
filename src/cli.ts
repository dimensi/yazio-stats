import { Command } from "commander";
import "dotenv/config";
import { registerSummaryCommand } from "./commands/summary.js";
import { registerMealsCommand } from "./commands/meals.js";
import { registerWaterCommand } from "./commands/water.js";
import { registerWeightCommand } from "./commands/weight.js";
import { registerExercisesCommand } from "./commands/exercises.js";
import { registerGoalsCommand } from "./commands/goals.js";

const program = new Command();

program
  .name("yazio-stats")
  .description("Extract nutrition statistics from YAZIO")
  .version("1.0.0");

registerSummaryCommand(program);
registerMealsCommand(program);
registerWaterCommand(program);
registerWeightCommand(program);
registerExercisesCommand(program);
registerGoalsCommand(program);

program.parse();
