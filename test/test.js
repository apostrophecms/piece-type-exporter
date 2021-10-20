const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');
// const _ = require('lodash');
// const request = require('request');

describe('Pieces Exporter', function () {
  let apos;

  this.timeout(10000);

  after(async function () {
    testUtil.destroy(apos);
  });

  it('should improve piece types on the apos object', async function () {
    apos = await testUtil.create({
      shortname: 'test-exporter',
      testModule: true,
      baseUrl: 'http://localhost:4242',
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 4242,
            trustProxy: true,
            csrf: false,
            session: { secret: 'test-the-exporter' }
          }
        },
        '@apostrophecms/pieces-exporter': {
          options: {
            exporterActive: true
          }
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            export: true
          },
          fields: {
            add: {
              richText: {
                type: 'area',
                widgets: {
                  '@apostrophecms/rich-text': {}
                }
              }
            }
          }
        }
      }
    });

    const productModule = apos.modules.product;

    assert(productModule.__meta.name === 'product');
    assert(productModule.options.export === true);
    // Pieces exporter is working and improving piece types.
    assert(productModule.options.exporterActive === true);
  });

  const richText = '<h2>This is rich text.</h2>';

  it('can insert many test products', async function () {
    const total = 50;
    const req = apos.task.getReq();
    let i = 1;
    const inserted = [];

    await insertNext();

    assert(inserted.length === 50);

    async function insertNext () {
      const product = Object.assign(apos.modules.product.newInstance(), {
        title: 'Cheese #' + padInteger(i, 5),
        slug: 'cheese-' + padInteger(i, 5),
        richText: {
          metaType: 'area',
          items: [
            {
              type: '@apostrophecms/rich-text',
              metaType: 'widget',
              content: richText
            }
          ]
        }
      });

      const doc = await apos.modules.product.insert(req, product);

      if (doc._id) {
        // Successful insertion. It now has a uid.
        inserted.push(doc._id);
      }

      i++;

      if (i <= total) {
        return insertNext();
      }

      return true;
    }
  });

  it('can export the products as a CSV', async function () {
    const req = apos.task.getReq();
    let good = 0;
    let bad = 0;
    let results;

    const reporting = {
      good: function () {
        good++;
      },
      bad: function () {
        bad++;
      },
      setResults: function (_results) {
        results = _results;
      }
    };

    try {
      await apos.modules.product.exportRun(req, reporting, {
        archived: false,
        extension: 'csv',
        format: apos.modules.product.exportFormats.csv,
        // Test multiple batches with a small number of products.
        batchSize: 10,
        // Don't let the timeout for deleting the report afterward prevent this
        // test from ending.
        expiration: 5000
      });
    } catch (error) {
      assert(!error);
    }

    assert(results.url);
    assert(good === 50);
    assert(!bad);

    // Hard-coded baseUrl with one forward slash due to a quirk in
    // self.apos.attachment.uploadfs.getUrl()
    const exported = await apos.http.get(results.url.replace('http:/localhost:4242', ''));
    assert(exported.match(/,Cheese #00001,/));
    assert(exported.indexOf(`,${richText}`) !== -1);
  });
});

function padInteger (i, places) {
  let s = i + '';
  while (s.length < places) {
    s = '0' + s;
  }
  return s;
}
