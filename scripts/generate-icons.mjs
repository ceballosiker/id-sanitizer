import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('./icon.svg', import.meta.url));

const rasterize = (size, outName) => {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  writeFileSync(`public/${outName}`, png);
  console.log(`wrote public/${outName} (${size}×${size})`);
};

rasterize(192, 'icon-192.png');
rasterize(512, 'icon-512.png');
rasterize(512, 'icon-512-maskable.png');
