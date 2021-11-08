[![CircleCI](https://circleci.com/gh/apostrophecms/piece-type-exporter/tree/main.svg?style=svg)](https://circleci.com/gh/apostrophecms/piece-type-exporter/tree/main)
[![Chat on Discord](https://img.shields.io/discord/517772094482677790.svg)](https://chat.apostrophecms.org)

# Apostrophe Pieces Exporter

This module adds an optional export feature to all piece type modules in an [Apostrophe](https://apostrophecms.com) project. This feature enables exporting *published* pieces of piece types where it is configured. Requires Apostrophe 3.

## Installation

```bash
npm install @apostrophecms/piece-type-exporter
```

## Use

### Initialization

Configure `@apostrophecms/piece-type-exporter` and the form widgets in `app.js`.

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    // The exporter module
    '@apostrophecms/piece-type-exporter': {},
    // A piece type that you want to make exportable
    'article': {
      options: {
        export: true
      }
    }
  }
});
```

The Pieces Exporter module improves all piece types in the site to add export functionality to them. To enable that functionality, **you must add the `export: true` option on the appropriate piece type(s)**. The example above demonstrates doing this in the `app.js` file. More often it will be preferable to set this option in the module's `index.js` file.

```javascript
// modules/article/index.js
module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    pluralLabel: 'Articles',
    export: true // 👈 Adding the export option.
  },
  // Other properties...
}
```

### Additional options

#### `omitFields`

You can specify properties to omit from exported documents with this option. The `export` option on the exportable piece type becomes an object with an `omitFields` property. `omitFields` takes an array of field names to omit.

For example, if you wanted to exclude the `archive` field from the export, you would configure your piece like this:

```javascript
// modules/article/index.js
module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    pluralLabel: 'Articles',
    export: {
      omitFields: [ 'archive' ]
    }
  },
  // Other properties...
}
```

#### `expiration`

By default, exported files are automatically deleted after one hour. You can change this time span by setting an `expiration` property on the `export` option. It should be set to an integer representing the number of milliseconds until expiration.

```javascript
// modules/article/index.js
module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    pluralLabel: 'Articles',
    export: {
      // 👇 Set to expire after two hours. Tip: Writing as an expression can
      // help make it clearer to other people.
      expiration: 1000 * 60 * 120
    }
  },
  // Other properties...
}
```

#### Export areas as plain text with `exportPlainText`

By default, this module exports areas as rich text. You will receive simple HTML markup corresponding to any rich text widgets present in those areas.

If you prefer, you can set the `exportPlainText: true` option *on an `area` schema field* to export it as plain text. In this case, tags are stripped and entities are un-escaped.

```javascript
// modules/article/index.js
module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Article',
    pluralLabel: 'Articles',
    export: true
  },
  fields: {
    add: {
      textArea: {
        type: 'area',
        widgets: {
          '@apostrophecms/rich-text': {}
        },
        options: {
          // 👇 The option set to export this area as plain text.
          exportPlainText: true
        }
      }
    }
  }
}
```

### Directly work with the export record in `beforeExport`

The exporter relies on a simple conversion from each standard field type to a string. It also only includes properties that related to registered schema fields. You can change this by implementing a `beforeExport` method in your piece type module.

`beforeExport` methods are provided the following arguments:
- `req`: The original request
- `piece`: The piece data to export
- `record` An object of piece data converted to strings for export

By default this method simply returns the converted record with each schema  property converted to a string. You may change any properties or add new properties to `record` based on what you see in `piece`. **`beforeExport` must return the `record` object with the same properties for every piece.**

```javascript
// modules/article/index.js
module.exports = {
  // Other properties...
  methods(self) {
    return {
      async beforeExport (req, piece, record) {
        let views;

        if (piece.visibility === 'public') {
          // Finding the view count with a hypothetical method.
          views = await self.getArticleViews(piece._id);
        }

        return {
          ...record,
          views: views || ''
        };
      }
    }
  }
}
```

`beforeExport` may be an asynchronous function.
