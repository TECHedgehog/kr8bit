export interface DemoGameSeed {
  id: string;
  appId: number;
  entryName: string;
  sizeBytes: number;
}

const catalog: Array<[number, string, number]> = [
  [400, 'Portal', 1_200_000_000], [620, 'Portal 2', 8_400_000_000],
  [220, 'Half-Life 2', 6_500_000_000], [440, 'Team Fortress 2', 15_000_000_000],
  [550, 'Left 4 Dead 2', 13_000_000_000], [72850, 'The Elder Scrolls V Skyrim', 12_000_000_000],
  [377160, 'Fallout 4', 35_000_000_000], [292030, 'The Witcher 3', 50_000_000_000],
  [1091500, 'Cyberpunk 2077', 70_000_000_000], [271590, 'Grand Theft Auto V', 95_000_000_000],
  [1174180, 'Red Dead Redemption 2', 120_000_000_000], [613830, 'Chrono Trigger', 1_240_000_000],
  [2280, 'DOOM', 420_000_000], [105600, 'Terraria', 500_000_000],
  [413150, 'Stardew Valley', 600_000_000], [1145360, 'Hades', 15_000_000_000],
  [367520, 'Hollow Knight', 9_000_000_000], [504230, 'Celeste', 1_200_000_000],
  [268910, 'Cuphead', 4_000_000_000], [588650, 'Dead Cells', 2_000_000_000],
  [387290, 'Ori and the Blind Forest', 8_000_000_000], [1057090, 'Ori and the Will of the Wisps', 15_000_000_000],
  [632470, 'Disco Elysium', 20_000_000_000], [264710, 'Subnautica', 20_000_000_000],
  [275850, 'No Mans Sky', 15_000_000_000], [892970, 'Valheim', 1_000_000_000],
  [252490, 'Rust', 25_000_000_000], [227300, 'Euro Truck Simulator 2', 25_000_000_000],
  [255710, 'Cities Skylines', 4_000_000_000], [220200, 'Kerbal Space Program', 4_000_000_000],
  [219740, 'Dont Starve', 1_000_000_000], [212680, 'FTL Faster Than Light', 500_000_000],
  [239030, 'Papers Please', 200_000_000], [391540, 'Undertale', 200_000_000],
  [814380, 'Sekiro Shadows Die Twice', 25_000_000_000], [1245620, 'Elden Ring', 60_000_000_000],
  [582010, 'Monster Hunter World', 50_000_000_000], [1086940, 'Baldurs Gate 3', 130_000_000_000],
  [435150, 'Divinity Original Sin 2', 60_000_000_000], [1328670, 'Mass Effect Legendary Edition', 110_000_000_000],
  [753640, 'Outer Wilds', 8_000_000_000], [653530, 'Return of the Obra Dinn', 2_000_000_000],
  [210970, 'The Witness', 5_000_000_000], [7670, 'BioShock', 8_000_000_000],
  [205100, 'Dishonored', 10_000_000_000], [337000, 'Deus Ex Mankind Divided', 17_000_000_000],
  [1659040, 'HITMAN World of Assassination', 80_000_000_000], [289070, 'Civilization VI', 20_000_000_000],
  [268500, 'XCOM 2', 60_000_000_000], [294100, 'RimWorld', 500_000_000],
  [427520, 'Factorio', 2_000_000_000],
];

export const DEMO_GAMES: DemoGameSeed[] = catalog.map(([appId, entryName, sizeBytes], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  appId,
  entryName,
  sizeBytes,
}));
