import * as fs from "fs";
import * as path from "path";
import * as inquirer from "inquirer";
import * as envfile from "envfile";

const stages = fs.readdirSync("./src/stages").filter(file => path.extname(file) === ".json");
const stageNames = stages.map(stage => path.basename(stage, ".json"));

if (stageNames.length === 0) {
    console.log("There is no stage to deploy. Run 'make new_stage' to create one.");
} else {
    const questions = [
        {
            type: "list",
            name: "stage",
            message: "Which stage would you like to deploy?",
            choices: stageNames,
        },
    ];
    inquirer.prompt(questions).then((answers: { stage: string }) => {
        const selectedStage = answers.stage;
        fs.writeFileSync(".env", envfile.stringify({ STAGE: selectedStage }));
    });
}
