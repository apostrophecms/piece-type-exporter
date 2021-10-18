const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');
// const _ = require('lodash');
// const request = require('request');

describe('Pieces Exporter', function () {
  let apos;

  this.timeout(5000);

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

  // it('insert many test products', function () {
  //   const total = 50;
  //   let i = 1;
  //   return insertNext();
  //   function insertNext () {
  //     const product = _.assign(apos.modules.products.newInstance(), {
  //       title: 'Cheese #' + padInteger(i, 5),
  //       slug: 'cheese-' + padInteger(i, 5),
  //       richText: {
  //         type: 'area',
  //         items: [
  //           {
  //             type: 'apostrophe-rich-text',
  //             content: '<h4>This stays rich text.</h4>'
  //           }
  //         ]
  //       },
  //       plaintext: {
  //         type: 'area',
  //         items: [
  //           {
  //             type: 'apostrophe-rich-text',
  //             content: '<h4>This becomes plaintext.</h4>'
  //           }
  //         ]
  //       }
  //     });
  //     return apos.modules.products.insert(apos.tasks.getReq(), product).then(function () {
  //       i++;
  //       if (i <= total) {
  //         return insertNext();
  //       }
  //       return true;
  //     });
  //   }
  // });

  // it('export the products', function (done) {
  //   const req = apos.tasks.getReq();
  //   let good = 0;
  //   let bad = 0;
  //   let results;
  //   apos.modules.products.exportRun(req, {
  //     good: function () {
  //       good++;
  //     },
  //     bad: function () {
  //       bad++;
  //     },
  //     setResults: function (_results) {
  //       results = _results;
  //     }
  //   }, {
  //     published: 'yes',
  //     extension: 'csv',
  //     format: apos.modules.products.exportFormats.csv,
  //     // test multiple batches with a small number of products
  //     batchSize: 10,
  //     // don't let the timeout for deleting the report afterwards
  //     // prevent this test from ending
  //     expiration: 5000
  //   }, function (err) {
  //     assert(!err);
  //     assert(good === 50);
  //     assert(!bad);
  //     assert(results);
  //     request(results.url, function (err, response, body) {
  //       assert(!err);
  //       assert(response.statusCode === 200);
  //       assert(body.match(/,Cheese #00001,/));
  //       assert(body.indexOf(',<h4>This stays rich text.</h4>,') !== -1);
  //       assert(body.indexOf(',This becomes plaintext.\n') !== -1);
  //       done();
  //     });
  //   });
  // });
});

// function padInteger (i, places) {
//   let s = i + '';
//   while (s.length < places) {
//     s = '0' + s;
//   }
//   return s;
// }
