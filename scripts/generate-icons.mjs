import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const masterSvg = readFileSync(new URL('./icon.svg', import.meta.url));
const maskableSvg = readFileSync(new URL('./icon-maskable.svg', import.meta.url));

const rasterize = (svg, size, outName) => {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  writeFileSync(`public/${outName}`, resvg.render().asPng());
  console.log(`wrote public/${outName} (${size}×${size})`);
};

rasterize(masterSvg, 192, 'icon-192.png');
rasterize(masterSvg, 512, 'icon-512.png');
rasterize(maskableSvg, 512, 'icon-512-maskable.png');

copyFileSync(
  new URL('./icon.svg', import.meta.url),
  new URL('../public/favicon.svg', import.meta.url),
);
console.log('wrote public/favicon.svg (copied from scripts/icon.svg)');
