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
      baseUrl: 'http://localhost:4242',
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
        '@apostrophecms/pieces-exporter': {
          options: {
            // A meaningless option to confirm the piece types are "improved."
            exporterActive: true
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            export: {
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

  it('can insert many test articles', async function () {
    const total = 50;
    const req = apos.task.getReq();
    const i = 1;
    const inserted = [];

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

    await insertNext(req, apos.modules.article, 'article', data, i, total, inserted);

    assert(inserted.length === 50);
  });

  it('can export the articles as a CSV', async function () {
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
      await apos.modules.article.exportRun(req, reporting, {
        extension: 'csv',
        format: apos.modules.article.exportFormats.csv,
        // Test multiple batches with a small number of articles.
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
    const exportedArticles = await apos.http.get(results.url.replace('http:/localhost:4242', ''));
    assert(exportedArticles.match(/,article #00001,/));
    assert(exportedArticles.indexOf(`,${richText}`) !== -1);
  });

  const plainText = 'This is plain text.';
  const plainTextWrapped = `<p>${plainText}</p>`;
  const secret = 'hide-me';

  it('can insert many test products', async function () {
    const total = 30;
    const req = apos.task.getReq();
    const i = 1;
    const inserted = [];

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

    await insertNext(req, apos.modules.product, 'product', data, i, total, inserted);

    assert(inserted.length === 30);
  });

  let exportedProducts;

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
        extension: 'csv',
        format: apos.modules.product.exportFormats.csv,
        // Test multiple batches with a small number of articles.
        batchSize: 10,
        // Don't let the timeout for deleting the report afterward prevent this
        // test from ending.
        expiration: 5000
      });
    } catch (error) {
      assert(!error);
    }

    assert(results.url);
    assert(good === 30);
    assert(!bad);

    // Hard-coded baseUrl with one forward slash due to a quirk in
    // self.apos.attachment.uploadfs.getUrl()
    exportedProducts = await apos.http.get(results.url.replace('http:/localhost:4242', ''));
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
        batchSize: 10
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
        job = await apos.http.post('/api/v1/@apostrophecms/job/progress?apikey=testKey', {
          body: {
            _id: id
          }
        });
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

async function insertNext (req, pieceModule, title, data, i, total, collection) {
  const docData = Object.assign(pieceModule.newInstance(), {
    title: `${title} #${padInteger(i, 5)}`,
    slug: `${title}-${padInteger(i, 5)}`,
    ...data
  });

  const doc = await pieceModule.insert(req, docData);

  if (doc._id) {
    // Successful insertion. It now has a uid.
    collection.push(doc._id);
  }

  i++;

  if (i <= total) {
    return insertNext(req, pieceModule, title, data, i, total, collection);
  }

  return true;
};
