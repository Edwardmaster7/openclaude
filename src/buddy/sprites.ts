import type { CompanionBones, Eye, Hat, Species } from "./types.js";
import {
  axolotl,
  bat,
  bear,
  blob,
  cactus,
  capybara,
  cat,
  chonk,
  crab,
  dragon,
  duck,
  ghost,
  goose,
  lion,
  mushroom,
  octopus,
  owl,
  penguin,
  rabbit,
  robot,
  snail,
  sprout,
  turtle,
  ufo,
} from "./types.js";

// Each sprite is 10 lines tall, 24 wide (after {E}→1char substitution).
// Multiple frames per species for idle fidget animation.
// Line 0 is the hat slot — must be blank in frames 0-1; frame 2 may use it.
const BODIES: Record<Species, string[][]> = {
  [duck]: [
    [
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "     __\\  ==  /__       ",
      "     \\_/______\\_/       ",
      "      /        \\        ",
      "     /   (--)   \\       ",
      "     \\          /       ",
      "      \\________/        ",
    ],
    [
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "     __\\  oo  /__       ",
      "     \\_/______\\_/       ",
      "      /        \\        ",
      "  ~~ /   (--)   \\ ~~    ",
      "     \\          /       ",
      "      \\________/        ",
    ],
    [
      "          *             ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "     __\\  ==  /__       ",
      "     \\_/______\\_/       ",
      "      /        \\        ",
      "     /   (--)   \\       ",
      "     \\          /       ",
      "      \\________/        ",
    ],
  ],
  [goose]: [
    [
      "                        ",
      "         ____           ",
      "       /      \\         ",
      "      |  {E}     \\        ",
      "      |       ___ >     ",
      "       \\____/           ",
      "         ||             ",
      "       /    \\_____      ",
      "      |  (        \\     ",
      "       \\___________/    ",
    ],
    [
      "                        ",
      "         ____           ",
      "       /      \\         ",
      "      |  {E}     \\        ",
      "      |       _ o >     ",
      "       \\____/           ",
      "         ||             ",
      "     ~~/    \\_____~~    ",
      "      |  (        \\     ",
      "       \\___________/    ",
    ],
    [
      "         !!!            ",
      "         ____           ",
      "       /      \\         ",
      "      |  {E}     \\        ",
      "      |       ___ >     ",
      "       \\____/           ",
      "         ||             ",
      "       /    \\_____      ",
      "      |  (        \\     ",
      "       \\___________/    ",
    ],
  ],
  [blob]: [
    [
      "                        ",
      "                        ",
      "                        ",
      "       _........_       ",
      "     /            \\     ",
      "    /    {E}    {E}    \\    ",
      "   |                |   ",
      "   |    (______)    |   ",
      "    \\______________/    ",
      "                        ",
    ],
    [
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "      _.........._      ",
      "    /    {E}    {E}    \\    ",
      "   |                |   ",
      "   |    (______)    |   ",
      "    \\______________/    ",
      "    ~~~~~~~~~~~~~~~~    ",
    ],
    [
      "          *             ",
      "                        ",
      "                        ",
      "       _........_       ",
      "     /            \\     ",
      "    /    {E}    {E}    \\    ",
      "   |                |   ",
      "   |    (______)    |   ",
      "    \\______________/    ",
      "                        ",
    ],
  ],
  [cat]: [
    [
      "                        ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |   {E}  {E}   |      ",
      "      |    w     |      ",
      "       \\________/       ",
      "       /   ||   \\       ",
      "      |   /  \\   |  _   ",
      "      \\__|    |__/ | |  ",
      "      (__)____(__)_|_|  ",
    ],
    [
      "                        ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |   {E}  {E}   |      ",
      "      |    o     |      ",
      "       \\________/       ",
      "       /   ||   \\       ",
      "      |   /  \\   |  _   ",
      "      \\__|    |__/ | |  ",
      "      (__)____(__)_|_|~~",
    ],
    [
      "         Zzz            ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |   {E}  {E}   |      ",
      "      |    -     |      ",
      "       \\________/       ",
      "       /   ||   \\       ",
      "      |   /  \\   |  _   ",
      "      \\__|    |__/ | |  ",
      "      (__)____(__)_|_|  ",
    ],
  ],
  [dragon]: [
    [
      "                        ",
      "        /\\    /\\        ",
      "       /  \\__/  \\       ",
      "      |   {E}  {E}   |      ",
      "     / \\  ----  / \\     ",
      "    /   \\______/   \\    ",
      "   | |   |    |   | |   ",
      "   |/   /      \\   \\|   ",
      "       |  ~~~~  |       ",
      "        \\______/        ",
    ],
    [
      "                        ",
      "        /\\    /\\        ",
      "       /  \\__/  \\       ",
      "      |   {E}  {E}   |      ",
      "     / \\  oooo  / \\     ",
      "    /   \\______/   \\    ",
      "   | |   |    |   | |   ",
      "   |/   /      \\   \\|   ",
      "       |  ~~~~  |       ",
      "        \\______/        ",
    ],
    [
      "       (  )             ",
      "        /\\    /\\        ",
      "       /  \\__/  \\       ",
      "      |   {E}  {E}   |      ",
      "     / \\  ----  / \\     ",
      "    /   \\______/   \\    ",
      "   | |   |    |   | |   ",
      "   |/   /      \\   \\|   ",
      "       |  ~~~~  |       ",
      "        \\______/        ",
    ],
  ],
  [octopus]: [
    [
      "                        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "      \\__________/      ",
      "     / | |  | | \\       ",
      "    / / \\/  \\/ \\ \\      ",
      "   / /          \\ \\     ",
      "  |/              \\|    ",
    ],
    [
      "                        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "      \\__________/      ",
      "    \\ \\ /\\  /\\ / /      ",
      "     \\ | |  | | /       ",
      "      \\|      |/        ",
      "                        ",
    ],
    [
      "           o            ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "      \\__________/      ",
      "     / | |  | | \\       ",
      "    / / \\/  \\/ \\ \\      ",
      "   / /          \\ \\     ",
      "  |/              \\|    ",
    ],
  ],
  [owl]: [
    [
      "                        ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |  {E}    {E}  |      ",
      "      |   >><<   |      ",
      "     /|________|\\       ",
      "    / /        \\ \\      ",
      "   | | \\______/ | |     ",
      "    \\ \\___||___/ /      ",
      "     \\__________/       ",
    ],
    [
      "                        ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |  {E}    {E}  |      ",
      "      |   >><<   |      ",
      "     /|________|\\       ",
      "    / /        \\ \\      ",
      "   | | \\______/ | |     ",
      "    \\ \\___||___/ /      ",
      "     \\__________/       ",
    ],
    [
      "          *             ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |  {E}    {E}  |      ",
      "      |   >><<   |      ",
      "     /|________|\\       ",
      "    / /        \\ \\      ",
      "   | | \\______/ | |     ",
      "    \\ \\___||___/ /      ",
      "     \\__________/       ",
    ],
  ],
  [penguin]: [
    [
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "      |   \\/   |        ",
      "     /|________|\\       ",
      "    / /        \\ \\      ",
      "   | |  (    )  | |     ",
      "   |/ \\        / \\|     ",
      "       ==== ====        ",
    ],
    [
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "      |   \\/   |        ",
      "     ||________||       ",
      "     ||        ||       ",
      "     || (    ) ||       ",
      "      \\        /        ",
      "       ==== ====        ",
    ],
    [
      "          *             ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "      |   \\/   |        ",
      "     /|________|\\       ",
      "    / /        \\ \\      ",
      "   | |  (    )  | |     ",
      "   |/ \\        / \\|     ",
      "       ==== ====        ",
    ],
  ],
  [turtle]: [
    [
      "                        ",
      "                        ",
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "     __\\__==__/__       ",
      "   /______________\\     ",
      "  //|            |\\\\    ",
      '  "" \\__________/ ""    ',
    ],
    [
      "                        ",
      "                        ",
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "     __\\__==__/__       ",
      "   /______________\\     ",
      "  //|            |\\\\    ",
      "  ~~ \\__________/ ~~    ",
    ],
    [
      "          *             ",
      "                        ",
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "     __\\__==__/__       ",
      "   /______________\\     ",
      "  //|            |\\\\    ",
      '  "" \\__________/ ""    ',
    ],
  ],
  [snail]: [
    [
      "                        ",
      "       {E}      {E}         ",
      "        \\    /          ",
      "         |__|    _.._   ",
      "         |  |  /      \\ ",
      "         |  | |  (@@)  |",
      "      ___|  |  \\      / ",
      "    /        \\  \\____/  ",
      "   /          \\         ",
      "   ~~~~~~~~~~~~         ",
    ],
    [
      "                        ",
      "       {E}      {E}         ",
      "        |    |          ",
      "         \\__/    _.._   ",
      "         |  |  /      \\ ",
      "         |  | |  (@@)  |",
      "      ___|  |  \\      / ",
      "    /        \\  \\____/  ",
      "   /          \\         ",
      "   ~~~~~~~~~~~~         ",
    ],
    [
      "         *              ",
      "       {E}      {E}         ",
      "        \\    /          ",
      "         |__|    _.._   ",
      "         |  |  /      \\ ",
      "         |  | |  (@@)  |",
      "      ___|  |  \\      / ",
      "    /        \\  \\____/  ",
      "   /          \\         ",
      "   ~~~~~~~~~~~~         ",
    ],
  ],
  [ghost]: [
    [
      "                        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     \\/\\/\\/\\/\\/\\/       ",
    ],
    [
      "                        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     /\\/\\/\\/\\/\\/\\       ",
    ],
    [
      "        ~      ~        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     |            |     ",
      "     \\/\\/\\/\\/\\/\\/       ",
    ],
  ],
  [axolotl]: [
    [
      "                        ",
      "         _...._         ",
      "    >--/        \\--<    ",
      "    >-|  {E}    {E}  |-<    ",
      "    >--\\   ..   /--<    ",
      "        \\______/        ",
      "       /        \\       ",
      "      |    ()    |      ",
      "      |__      __|      ",
      "      \\_/      \\_/      ",
    ],
    [
      "                        ",
      "         _...._         ",
      "    <--/        \\-->    ",
      "    <-|  {E}    {E}  |->    ",
      "    <--\\   ..   /-->    ",
      "        \\______/        ",
      "       /        \\       ",
      "      |    ()    |      ",
      "      |__      __|      ",
      "      \\_/      \\_/      ",
    ],
    [
      "          *             ",
      "         _...._         ",
      "    >--/        \\--<    ",
      "    >-|  {E}    {E}  |-<    ",
      "    >--\\   ..   /--<    ",
      "        \\______/        ",
      "       /        \\       ",
      "      |    ()    |      ",
      "      |__      __|      ",
      "      \\_/      \\_/      ",
    ],
  ],
  [capybara]: [
    [
      "                        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "     |   (----)   |     ",
      "      \\__________/      ",
      "      /          \\      ",
      "     |   |    |   |     ",
      "     |___|____|___|     ",
    ],
    [
      "                        ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "     |   (o--o)   |     ",
      "      \\__________/      ",
      "      /          \\      ",
      "     |   |    |   |     ",
      "     |___|____|___|     ",
    ],
    [
      "         Zzz            ",
      "        _......_        ",
      "      /          \\      ",
      "     |   {E}    {E}   |     ",
      "     |            |     ",
      "     |   (----)   |     ",
      "      \\__________/      ",
      "      /          \\      ",
      "     |   |    |   |     ",
      "     |___|____|___|     ",
    ],
  ],
  [cactus]: [
    [
      "                        ",
      "          _.._          ",
      "        /      \\        ",
      "   _   |        |   _   ",
      "  | |  |  {E}  {E}  |  | |  ",
      "  | |__|        |__| |  ",
      "   \\____        ____/   ",
      "        |      |        ",
      "       [========]       ",
      "        \\______/        ",
    ],
    [
      "                        ",
      "          _.._          ",
      "        /      \\        ",
      "       |        |       ",
      "   _   |  {E}  {E}  |   _   ",
      "  | |__|        |__| |  ",
      "   \\____        ____/   ",
      "        |      |        ",
      "       [========]       ",
      "        \\______/        ",
    ],
    [
      "          *             ",
      "          _.._          ",
      "        /      \\        ",
      "   _   |        |   _   ",
      "  | |  |  {E}  {E}  |  | |  ",
      "  | |__|        |__| |  ",
      "   \\____        ____/   ",
      "        |      |        ",
      "       [========]       ",
      "        \\______/        ",
    ],
  ],
  [robot]: [
    [
      "                        ",
      "        .------.        ",
      "        |      |        ",
      "        | {E}  {E} |        ",
      "        | ==== |        ",
      "        '------'        ",
      "       /|      |\\       ",
      "      / |      | \\      ",
      "     |  |______|  |     ",
      "     |_| [][][] |_|     ",
    ],
    [
      "                        ",
      "        .------.        ",
      "        |      |        ",
      "        | {E}  {E} |        ",
      "        | -==- |        ",
      "        '------'        ",
      "       /|      |\\       ",
      "      / |      | \\      ",
      "     |  |______|  |     ",
      "     |_| [][][] |_|     ",
    ],
    [
      "          ||            ",
      "        .------.        ",
      "        |      |        ",
      "        | {E}  {E} |        ",
      "        | ==== |        ",
      "        '------'        ",
      "       /|      |\\       ",
      "      / |      | \\      ",
      "     |  |______|  |     ",
      "     |_| [][][] |_|     ",
    ],
  ],
  [rabbit]: [
    [
      "                        ",
      "        /\\    /\\        ",
      "       //    //         ",
      "      /  \\__/  \\        ",
      "     |   {E}  {E}   |       ",
      "     |    ..    |       ",
      "      \\________/        ",
      "      /        \\        ",
      "     /   (__)   \\       ",
      "    (____)__(____)      ",
    ],
    [
      "                        ",
      "        /\\    /\\        ",
      "       ||    ||         ",
      "      /  \\__/  \\        ",
      "     |   {E}  {E}   |       ",
      "     |    ..    |       ",
      "      \\________/        ",
      "      /        \\        ",
      "     /   (__)   \\       ",
      "    (____)__(____)      ",
    ],
    [
      "          *             ",
      "        /\\    /\\        ",
      "       //    //         ",
      "      /  \\__/  \\        ",
      "     |   {E}  {E}   |       ",
      "     |    ..    |       ",
      "      \\________/        ",
      "      /        \\        ",
      "     /   (__)   \\       ",
      "    (____)__(____)      ",
    ],
  ],
  [mushroom]: [
    [
      "                        ",
      "        .------.        ",
      "      /   ()   \\        ",
      "     / ()    () \\       ",
      "    /____________\\      ",
      "        |    |          ",
      "        |{E}  {E}|          ",
      "        |    |          ",
      "      __|____|__        ",
      "     (___----___)       ",
    ],
    [
      "                        ",
      "        .------.        ",
      "      /   ()   \\        ",
      "     / ()    () \\       ",
      "    /____________\\      ",
      "        |    |          ",
      "        |{E}  {E}|          ",
      "        |    |          ",
      "      __|____|__        ",
      "     (___----___)~~     ",
    ],
    [
      "          *             ",
      "        .------.        ",
      "      /   ()   \\        ",
      "     / ()    () \\       ",
      "    /____________\\      ",
      "        |    |          ",
      "        |{E}  {E}|          ",
      "        |    |          ",
      "      __|____|__        ",
      "     (___----___)       ",
    ],
  ],
  [chonk]: [
    [
      "                        ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |   {E}  {E}   |      ",
      "      |    w     |      ",
      "     /            \\     ",
      "    /              \\    ",
      "   |                | _ ",
      "   |                || |",
      "   \\________________||_|",
    ],
    [
      "                        ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |   {E}  {E}   |      ",
      "      |    w     |      ",
      "     /            \\     ",
      "    /              \\    ",
      "   |                | _ ",
      "   |                || |",
      "   \\________________||_|",
    ],
    [
      "         Zzz            ",
      "        /\\____/\\        ",
      "       /        \\       ",
      "      |   {E}  {E}   |      ",
      "      |    -     |      ",
      "     /            \\     ",
      "    /              \\    ",
      "   |                | _ ",
      "   |                || |",
      "   \\________________||_|",
    ],
  ],
  [lion]: [
    [
      "                        ",
      "      /\\_////\\\\_/\\      ",
      "     //          \\\\     ",
      "    //    {E}  {E}    \\\\    ",
      "    ||     w      ||    ",
      "     \\\\__________//     ",
      "       / |    | \\       ",
      "      |  /    \\  |      ",
      "      |__|    |__|      ",
      "      (__)____(__)      ",
    ],
    [
      "                        ",
      "      /\\_////\\\\_/\\      ",
      "     //          \\\\     ",
      "    //    {E}  {E}    \\\\    ",
      "    ||     o      ||    ",
      "     \\\\__________//     ",
      "       / |    | \\       ",
      "      |  /    \\  |      ",
      "      |__|    |__|      ",
      "      (__)____(__)~~    ",
    ],
    [
      "         Zzz            ",
      "      /\\_////\\\\_/\\      ",
      "     //          \\\\     ",
      "    //    {E}  {E}    \\\\    ",
      "    ||     -      ||    ",
      "     \\\\__________//     ",
      "       / |    | \\       ",
      "      |  /    \\  |      ",
      "      |__|    |__|      ",
      "      (__)____(__)      ",
    ],
  ],
  [crab]: [
    [
      "                        ",
      "      \\//      \\//      ",
      "      |/        \\|      ",
      "       \\  _.._  /       ",
      "        /      \\        ",
      "       | {E}    {E} |       ",
      "     ___|  __  |___     ",
      "    /   \\      /   \\    ",
      "   /  /\\ \\____/ /\\  \\   ",
      "  /  /  \\      /  \\  \\  ",
    ],
    [
      "                        ",
      "      \\//      \\//      ",
      "      |/        \\|      ",
      "       \\  _.._  /       ",
      "        /      \\        ",
      "       | {E}    {E} |       ",
      "     ___|  __  |___     ",
      "    /   \\      /   \\    ",
      "   \\  \\/ /____\\ \\/  /   ",
      "    \\  \\/      \\/  /    ",
    ],
    [
      "          *             ",
      "      \\//      \\//      ",
      "      |/        \\|      ",
      "       \\  _.._  /       ",
      "        /      \\        ",
      "       | {E}    {E} |       ",
      "     ___|  __  |___     ",
      "    /   \\      /   \\    ",
      "   /  /\\ \\____/ /\\  \\   ",
      "  /  /  \\      /  \\  \\  ",
    ],
  ],
  [bear]: [
    [
      "                        ",
      "       _........_       ",
      "     /(_)\\____/(_)\\     ",
      "    |              |    ",
      "    |   {E}      {E}   |    ",
      "    |    (____)    |    ",
      "     \\____________/     ",
      "      /          \\      ",
      "     |     ()     |     ",
      "     \\____________/     ",
    ],
    [
      "                        ",
      "       _........_       ",
      "     /(_)\\____/(_)\\     ",
      "    |              |    ",
      "    |   {E}      {E}   |    ",
      "    |    (oooo)    |    ",
      "     \\____________/     ",
      "      /          \\      ",
      "     |     ()     |     ",
      "     \\____________/     ",
    ],
    [
      "          *             ",
      "       _........_       ",
      "     /(_)\\____/(_)\\     ",
      "    |              |    ",
      "    |   {E}      {E}   |    ",
      "    |    (____)    |    ",
      "     \\____________/     ",
      "      /          \\      ",
      "     |     ()     |     ",
      "     \\____________/     ",
    ],
  ],
  [ufo]: [
    [
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "    ___\\______/___      ",
      "   <==============>     ",
      "      /        \\        ",
      "     /   _.._   \\       ",
      "    /   /    \\   \\      ",
      "   /___/      \\___\\     ",
    ],
    [
      "                        ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "    ___\\______/___      ",
      "   <--==========-->     ",
      "      \\        /        ",
      "       \\ _.._ /         ",
      "       /      \\         ",
      "      /________\\        ",
    ],
    [
      "          *             ",
      "         _.._           ",
      "       /      \\         ",
      "      |  {E}  {E}  |        ",
      "    ___\\______/___      ",
      "   <==============>     ",
      "      /        \\        ",
      "     /   _.._   \\       ",
      "    /   /    \\   \\      ",
      "   /___/      \\___\\     ",
    ],
  ],
  [sprout]: [
    [
      "                        ",
      "          \\/            ",
      "        __||__          ",
      "      /        \\        ",
      "     |   {E}  {E}   |       ",
      "      \\________/        ",
      "     /__________\\       ",
      "     \\          /       ",
      "      \\        /        ",
      "       \\______/         ",
    ],
    [
      "                        ",
      "          \\/            ",
      "        __||__          ",
      "      /        \\        ",
      "     |   {E}  {E}   |       ",
      "      \\________/        ",
      "     /__________\\       ",
      "     \\          /       ",
      "      \\        /        ",
      "       \\______/~~       ",
    ],
    [
      "          *             ",
      "          \\/            ",
      "        __||__          ",
      "      /        \\        ",
      "     |   {E}  {E}   |       ",
      "      \\________/        ",
      "     /__________\\       ",
      "     \\          /       ",
      "      \\        /        ",
      "       \\______/         ",
    ],
  ],
  [bat]: [
    [
      "                        ",
      "         /\\__/\\         ",
      "   |\\   /      \\   /|   ",
      "   | \\ /  {E}  {E}  \\ / |   ",
      "    \\_\\    ww    /_/    ",
      "       \\________/       ",
      "        /  ||  \\        ",
      "       /   ||   \\       ",
      "      |____||____|      ",
      "        \\/    \\/        ",
    ],
    [
      "                        ",
      "         /\\__/\\         ",
      "   |/   /      \\   \\|   ",
      "   | / \\  {E}  {E}  / \\ |   ",
      "    / /    ww    \\ \\    ",
      "       \\________/       ",
      "        /  ||  \\        ",
      "       /   ||   \\       ",
      "      |____||____|      ",
      "        \\/    \\/        ",
    ],
    [
      "        ~      ~        ",
      "         /\\__/\\         ",
      "   |\\   /      \\   /|   ",
      "   | \\ /  {E}  {E}  \\ / |   ",
      "    \\_\\    ww    /_/    ",
      "       \\________/       ",
      "        /  ||  \\        ",
      "       /   ||   \\       ",
      "      |____||____|      ",
      "        \\/    \\/        ",
    ],
  ],
};

const HAT_LINES: Record<Hat, string> = {
  none: "",
  crown: "      \\^^^^^^//        ",
  tophat: "      [[______]]        ",
  propeller: "        --++--          ",
  halo: "      ((      ))        ",
  wizard: "        //^^\\          ",
  beanie: "      ((______))        ",
  tinyduck: "        ,,>>            ",
  pirate: "      __//))    //      ",
  chef: "      ______(())        ",
  santa: "      __{{}}____        ",
  party: "      <<::>>____        ",
  headphones: "      [[====]]          ",
};

export type OutfitStyle = {
  color?: string; // Outfit color (overrides rarity). If undefined, keeps rarity color.
  symbol: string;
  eye?: string; // Custom eye character (replaces companion eye)
  extraTop?: string[]; // Extra lines above sprite
  extraBottom?: string[]; // Extra lines below sprite
  dim?: boolean; // Render sprite as dim
  blinkSpeed?: number; // Blink speed multiplier (1 = normal, 2 = faster)
  keepRarityColor?: boolean; // If true, keep rarity color even if color is set
};

export type ThemeStyle = {
  color?: string; // Override text color
  extraTop?: string[];
  extraBottom?: string[];
  dimColor?: boolean;
};

const THEME_STYLES: Record<string, ThemeStyle> = {
  'fundo-noturno': {
    color: 'blue',
    extraTop: ['    ✦  ·  ✦    ·   ✦    '],
    extraBottom: ['   ·    ✦   ·    ✦   ·  '],
  },
  'fundo-oceanico': {
    color: 'cyan',
    extraTop: ['   ~  ~  ~  ~  ~  ~  ~  '],
    extraBottom: ['  ~  ~  ~  ~  ~  ~  ~   '],
  },
  'fundo-espacial': {
    color: 'magenta',
    extraTop: ['  ✦  ·  ✦  ·  ✦  ·  ✦  '],
    extraBottom: ['  ·  ✦  ·  ✦  ·  ✦  ·  '],
  },
  'fogo': {
    color: 'red',
    extraTop: ['    🔥  🔥  🔥  🔥  🔥   '],
    extraBottom: ['   🔥  🔥  🔥  🔥  🔥    '],
  },
  'neve': {
    color: 'white',
    extraTop: ['   ❄  ·  ❄  ·  ❄  ·  ❄ '],
    extraBottom: ['  ·  ❄  ·  ❄  ·  ❄  ·  '],
  },
  'glitch': {
    color: 'green',
    extraTop: ['   ▓▒░ GLITCH ░▒▓       '],
    extraBottom: ['   ░▒▓ GLITCH ▓▒░       '],
  },
  'pixel-hearts': {
    color: 'red',
    extraTop: ['    ♥  ♥  ♥  ♥  ♥  ♥    '],
    extraBottom: ['   ♥  ♥  ♥  ♥  ♥  ♥     '],
  },
}

export function getThemeStyle(themeId: string | null): ThemeStyle | undefined {
  if (!themeId) return undefined
  return THEME_STYLES[themeId]
}

export type AccessoryStyle = {
  eye?: string; // Custom eye (single, applies to both)
  leftEye?: string; // Custom left eye only (for monoculo)
  rightEye?: string; // Custom right eye only (for monoculo)
  extraTop?: string[]; // Extra lines above sprite
  extraBottom?: string[]; // Extra lines below sprite
};

const ACCESSORY_STYLES: Record<string, AccessoryStyle> = {
  oculos: {
    leftEye: '■',
    rightEye: '■',
  },
  monoculo: {
    leftEye: '◉',
  },
  laco: {
    extraBottom: ['        ╱╲╱╲             '],
  },
  bandana: {
    extraTop: ['      ▓▓▓▓▓▓▓▓           '],
  },
  'coroa-flores': {
    extraTop: ['     🌸🌼🌸🌼🌸           '],
  },
  chifres: {
    extraTop: ['     /\\      /\\           '],
  },
  asas: {
    extraTop: ['  ╱              ╲       '],
    extraBottom: ['  ╲              ╱       '],
  },
  capa: {
    extraBottom: ['   ╲|            |╱      ', '    ╲____________╱       '],
  },
  mochila: {
    extraBottom: ['       [████]            '],
  },
  aura: {
    extraTop: ['    ·  ·  ·  ·  ·  ·     '],
    extraBottom: ['    ·  ·  ·  ·  ·  ·     '],
  },
}

export function getAccessoryStyles(accessoryIds: string[]): AccessoryStyle[] {
  return accessoryIds
    .map(id => ACCESSORY_STYLES[id])
    .filter((s): s is AccessoryStyle => !!s)
}

export function mergeAccessoryStyles(styles: AccessoryStyle[]): {
  eye?: string
  leftEye?: string
  rightEye?: string
  extraTop: string[]
  extraBottom: string[]
} {
  const result = {
    eye: undefined as string | undefined,
    leftEye: undefined as string | undefined,
    rightEye: undefined as string | undefined,
    extraTop: [] as string[],
    extraBottom: [] as string[],
  }
  for (const style of styles) {
    if (style.eye) result.eye = style.eye
    if (style.leftEye) result.leftEye = style.leftEye
    if (style.rightEye) result.rightEye = style.rightEye
    if (style.extraTop) result.extraTop.push(...style.extraTop)
    if (style.extraBottom) result.extraBottom.push(...style.extraBottom)
  }
  return result
}

const OUTFIT_STYLES: Record<string, OutfitStyle> = {
  dourado: {
    color: "yellow",
    symbol: "*",
    eye: "✦",
    extraTop: ["      ✦    ✦            "],
    extraBottom: ["    ✦        ✦          "],
  },
  neon: {
    color: "cyan",
    symbol: "°",
    eye: "◉",
    extraBottom: ["  °°°°°°°°°°°°°°°°°°°°  "],
  },
  cyber: {
    color: "green",
    symbol: "0",
    eye: "@",
    extraTop: ["  01 10 01 10 01 10     "],
    extraBottom: ["  10 01 10 01 10 01     "],
  },
  fantasma: {
    color: "gray",
    symbol: "~",
    dim: true,
    eye: "×",
  },
  "arco-iris": {
    color: "magenta",
    symbol: "◇",
    eye: "◈",
    extraTop: ["  ◇  ◇  ◇  ◇  ◇  ◇      "],
  },
  viking: {
    color: "red",
    symbol: "]",
    eye: "◉",
    extraTop: ["        /^^^\\          "],
    extraBottom: ["      [_______]         "],
  },
  "pixel-art": {
    color: "blue",
    symbol: "█",
    eye: "[]",
    extraBottom: ["  ████  ████  ████      "],
  },
  invisivel: {
    color: "gray",
    symbol: " ",
    dim: true,
    eye: "·",
  },
  fogo: {
    color: "red",
    symbol: "~",
    eye: "◉",
    extraBottom: ["   ~\/~~~\/~~~\/~~      ", "    ~\/~~~\/~~\/~~      "],
  },
  geladeira: {
    color: "cyan",
    symbol: "*",
    eye: "❄",
    extraTop: ["    *  ❄  *  ❄          "],
    extraBottom: ["   ❄  *  ❄  *  ❄        "],
  },
  hacker: {
    color: "green",
    symbol: ">",
    eye: "@",
    extraTop: ["  > sudo access_        "],
    extraBottom: ["  > root@buddy# _       "],
  },
  festivo: {
    color: "yellow",
    symbol: "✦",
    eye: "★",
    extraTop: ["  ✦  *  ✦  *  ✦  *      "],
    extraBottom: ["  *  ✦  *  ✦  *  ✦      "],
  },
  ninja: {
    color: "gray",
    symbol: "»",
    eye: ">",
    blinkSpeed: 3,
    dim: true,
  },
};

export function getOutfitStyle(
  outfitId: string | null,
): OutfitStyle | undefined {
  if (!outfitId) return undefined;
  return OUTFIT_STYLES[outfitId];
}

export function renderSprite(bones: CompanionBones, frame = 0): string[] {
  const frames = BODIES[bones.species];
  const body = frames[frame % frames.length]!.map((line) =>
    line.replaceAll("{E}", bones.eye),
  );
  const lines = [...body];
  // Only replace with hat if line 0 is empty (some fidget frames use it for smoke etc)
  if (bones.hat !== "none" && !lines[0]!.trim()) {
    lines[0] = HAT_LINES[bones.hat];
  }
  // Drop blank hat slot — wastes a row in the Card and ambient sprite when
  // there's no hat and the frame isn't using it for smoke/antenna/etc.
  // Only safe when ALL frames have blank line 0; otherwise heights oscillate.
  if (!lines[0]!.trim() && frames.every((f) => !f[0]!.trim())) lines.shift();
  return lines;
}

export function spriteFrameCount(species: Species): number {
  return BODIES[species].length;
}

export function renderFace(bones: CompanionBones): string {
  const eye: Eye = bones.eye;
  switch (bones.species) {
    case duck:
    case goose:
      return `(${eye}>`;
    case blob:
      return `(${eye}${eye})`;
    case cat:
      return `=${eye}ω${eye}=`;
    case dragon:
      return `<${eye}~${eye}>`;
    case octopus:
      return `~(${eye}${eye})~`;
    case owl:
      return `(${eye})(${eye})`;
    case penguin:
      return `(${eye}>)`;
    case turtle:
      return `[${eye}_${eye}]`;
    case snail:
      return `${eye}(@)`;
    case ghost:
      return `/${eye}${eye}\\`;
    case axolotl:
      return `}${eye}.${eye}{`;
    case capybara:
      return `(${eye}oo${eye})`;
    case cactus:
      return `|${eye}  ${eye}|`;
    case robot:
      return `[${eye}${eye}]`;
    case rabbit:
      return `(${eye}..${eye})`;
    case mushroom:
      return `|${eye}  ${eye}|`;
    case chonk:
      return `(${eye}.${eye})`;
    case lion:
      return `(${eye}ω${eye})`;
    case crab:
      return `(${eye}__${eye})`;
    case bear:
      return `(${eye}.${eye})`;
    case ufo:
      return `(${eye}${eye})`;
    case sprout:
      return `(${eye}${eye})`;
    case bat:
      return `(${eye}${eye})`;
  }
}
