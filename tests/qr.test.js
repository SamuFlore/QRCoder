import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const output = 'node_modules/.cache/qr-test-bundle.js';
mkdirSync('node_modules/.cache', { recursive: true });
const result = spawnSync(process.execPath, [require.resolve('esbuild/bin/esbuild'), 'src/qr.js', '--bundle', '--platform=browser', '--format=iife', '--global-name=qrModule', '--outfile=' + output], { stdio: 'inherit' });
if (result.error) throw result.error;
assert.equal(result.status, 0);
const context = {
  document: {
    createElement(name) {
      assert.equal(name, 'canvas');
      let image;
      return {
        style: {},
        getContext() {
          return {
            createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
            clearRect() {},
            putImageData(value) { image = value; },
          };
        },
        toDataURL(type) {
          assert.equal(type, 'image/png');
          return 'data:image/png;base64,' + PNG.sync.write({ ...image, data: Buffer.from(image.data) }).toString('base64');
        },
      };
    },
  },
  Uint8ClampedArray, TextEncoder, TextDecoder,
};
runInNewContext(readFileSync(output, 'utf8'), context);
const { generateDataUrl, decodeImageData } = context.qrModule;

for (const text of ['Hello, QR code!', '中文二维码：你好，世界！', 'https://example.com/path?q=%E4%B8%AD%E6%96%87&x=1']) {
  test('browser bundle round trip: ' + text, async () => {
    const url = await generateDataUrl(text, { size: 320, margin: 4, dark: '#112233', light: '#ffffff' });
    assert.match(url, /^data:image\/png;base64,/);
    const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
    assert.equal(png.width, 320);
    assert.equal(png.height, 320);
    assert.equal(decodeImageData({ width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }), text);
  });
}

test('empty and oversized text reject', async () => {
  await assert.rejects(generateDataUrl(''));
  await assert.rejects(generateDataUrl('x'.repeat(10000)));
});

test('invalid or blank image returns null', () => {
  assert.equal(decodeImageData(null), null);
  assert.equal(decodeImageData({ width: 2, height: 2, data: new Uint8ClampedArray(3) }), null);
  assert.equal(decodeImageData({ width: 20, height: 20, data: new Uint8ClampedArray(20 * 20 * 4).fill(255) }), null);
});

test('invalid size and margin reject', async () => {
  await assert.rejects(generateDataUrl('x', { size: 0 }));
  await assert.rejects(generateDataUrl('x', { margin: -1 }));
});
