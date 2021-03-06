const assert = require('assert');
const testUtil = require('apostrophe/test-lib/test');

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
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 4242,
            trustProxy: true,
            apiKeys: {
              testKey: {
                role: 'admin'
              }
            },
            csrf: {
              exceptions: [
                '/api/v1/@apostrophecms/article/export'
              ]
            },
            session: { secret: 'test-the-exporter' }
          }
        },
        '@apostrophecms/piece-type-exporter': {
          options: {
            // A meaningless option to confirm the piece types are "improved."
            exporterActive: true
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            export: {
              batchSize: 10,
              expiration: 5000
            }
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
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            export: {
              omitFields: [ 'secret' ],
              batchSize: 10,
              expiration: 5000
            }
          },
          fields: {
            add: {
              secret: {
                type: 'string'
              },
              plainText: {
                type: 'area',
                widgets: {
                  '@apostrophecms/rich-text': {}
                },
                options: {
                  exportPlainText: true
                }
              }
            }
          }
        }
      }
    });

    const articleModule = apos.modules.article;
    const productModule = apos.modules.product;

    assert(articleModule.__meta.name === 'article');
    assert(typeof articleModule.options.export === 'object');
    assert(productModule.__meta.name === 'product');
    assert(typeof productModule.options.export === 'object');
    // Pieces exporter is working and improving piece types.
    assert(productModule.options.exporterActive === true);
  });

  const richText = '<h2>This is rich text.</h2>';
  let _ids1 = [];

  it('can insert many test articles', async function () {
    const req = apos.task.getReq();

    const data = {
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
    };

    const promises = [];

    for (let i = 1; i <= 50; i++) {
      promises.push(insert(req, apos.modules.article, 'article', data, i));
    }

    const inserted = await Promise.all(promises);
    _ids1 = inserted.map(doc => doc._id);

    assert(inserted.length === 50);
    assert(!!inserted[0]._id);
  });

  it('can export the articles as a CSV', async function () {
    const req = apos.task.getReq();
    req.body = req.body || {};
    req.body._ids = _ids1;

    let good = 0;
    let bad = 0;
    let results;

    const reporting = {
      success: function () {
        good++;
      },
      failure: function () {
        bad++;
      },
      setResults: function (_results) {
        results = _results;
      }
    };

    try {
      await apos.modules.article.exportRun(req, reporting, {
        extension: 'csv',
        format: apos.modules.article.exportFormats.csv
      });
    } catch (error) {
      assert(!error);
    }

    assert(results.url);
    assert(good === 50);
    assert(!bad);

    const exportedArticles = await apos.http.get(results.url);
    assert(exportedArticles.match(/,article #00001,/));
    assert(exportedArticles.indexOf(`,${richText}`) !== -1);
  });

  const plainText = 'This is plain text.';
  const plainTextWrapped = `<p>${plainText}</p>`;
  const secret = 'hide-me';
  let _ids2 = [];
  it('can insert many test products', async function () {
    const req = apos.task.getReq();

    const data = {
      plainText: {
        metaType: 'area',
        items: [
          {
            type: '@apostrophecms/rich-text',
            metaType: 'widget',
            content: plainTextWrapped
          }
        ]
      },
      secret
    };

    const promises = [];

    for (let i = 1; i <= 30; i++) {
      promises.push(insert(req, apos.modules.product, 'product', data, i));
    }

    const inserted = await Promise.all(promises);
    _ids2 = inserted.map(doc => doc._id);

    assert(inserted.length === 30);
    assert(!!inserted[0]._id);
  });

  let exportedProducts;

  it('can export the products as a CSV', async function () {
    const req = apos.task.getReq();
    req.body = req.body || {};
    req.body._ids = _ids2;

    let good = 0;
    let bad = 0;
    let results;

    const reporting = {
      success: function () {
        good++;
      },
      failure: function () {
        bad++;
      },
      setResults: function (_results) {
        results = _results;
      }
    };

    try {
      await apos.modules.product.exportRun(req, reporting, {
        extension: 'csv',
        format: apos.modules.product.exportFormats.csv
      });
    } catch (error) {
      assert(!error);
    }

    assert(results.url);
    assert(good === 30);
    assert(!bad);

    exportedProducts = await apos.http.get(results.url);
    assert(exportedProducts.match(/,product #00001,/));
  });

  it('can convert product rich text to plain text', async function () {
    assert(exportedProducts.indexOf(`,${plainTextWrapped}`) === -1);
    assert(exportedProducts.indexOf(`,${plainText}`) !== -1);
  });

  it('can omit the secret product field', async function () {
    assert(exportedProducts.indexOf(`,${secret}`) === -1);
  });

  // API Route test
  let jobInfo;

  it('can get a job ID from the export route', async function () {
    jobInfo = await apos.http.post('/api/v1/article/export?apikey=testKey', {
      body: {
        extension: 'csv',
        _ids: _ids1
      }
    });

    assert(jobInfo.jobId);
  });

  it('can eventually get the exported CSV url back from the job', async function () {
    const complete = await checkJob(jobInfo.jobId);

    assert(complete && complete.results.url);

    async function checkJob (id) {
      let job;

      try {
        job = await apos.http.get(`/api/v1/@apostrophecms/job/${id}?apikey=testKey`, {});
      } catch (error) {
        assert(!error);
        return null;
      }

      if (!job.ended) {
        await new Promise(resolve => {
          setTimeout(resolve, 2000);
        });

        return checkJob(id);
      }

      return job;
    }
  });
});

function padInteger (i, places) {
  let s = i + '';
  while (s.length < places) {
    s = '0' + s;
  }
  return s;
}

async function insert (req, pieceModule, title, data, i) {
  const docData = Object.assign(pieceModule.newInstance(), {
    title: `${title} #${padInteger(i, 5)}`,
    slug: `${title}-${padInteger(i, 5)}`,
    ...data
  });

  return pieceModule.insert(req, docData);
};
