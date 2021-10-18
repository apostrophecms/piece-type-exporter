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
      shortname: 'formsTest',
      testModule: true,
      baseUrl: 'http://localhost:4242',
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 4242,
            // csrf: { exceptions: [ '/api/v1/@apostrophecms/form/submit' ] },
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

  it('insert many test products', async function () {
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
              content: '<h2>This is rich text.</h2>'
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

  it('export the products', async function () {
    const req = apos.task.getReq();
    let good = 0;
    let bad = 0;
    let results;

    apos.modules.product.exportRun(req, {
      success: function () {
        good++;
      },
      failure: function () {
        bad++;
      },
      getResults: function (_results) {
        results = _results;
      }
    }, {
      published: 'yes',
      extension: 'csv',
      format: apos.modules.product.exportFormats.csv,
      // Test multiple batches with a small number of products.
      batchSize: 10,
      // Don't let the timeout for deleting the report afterward prevent this
      // test from ending.
      expiration: 5000
    });

    assert(results.url);
    assert(good === 50);
    assert(!bad);

    const exported = apos.http.get(results.url);
    assert(exported.match(/,Cheese #00001,/));
    assert(exported.indexOf(',<h4>This stays rich text.</h4>,') !== -1);
  });
});

function padInteger (i, places) {
  let s = i + '';
  while (s.length < places) {
    s = '0' + s;
  }
  return s;
}
