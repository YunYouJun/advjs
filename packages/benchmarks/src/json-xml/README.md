# JSON VS XML

JSON 与 XML 性能对比

使用 [benny](https://github.com/caderek/benny)。

## Result

```bash
Running "JSON-XML" suite...
Progress: 100%

  Read and Parse JSON by JSON.parse:
    29 ops/s, ±4.36%   | fastest

  Read and Parse XML by xml2js without promise:
    10 ops/s, ±4.16%   | 65.52% slower

  Read and Parse XML by xml2js:
    9 ops/s, ±6.23%    | slowest, 68.97% slower

Finished 3 cases!
  Fastest: Read and Parse JSON by JSON.parse
  Slowest: Read and Parse XML by xml2js
```

## Usage

- `generate.ts`: Generate Random JSON & XML Data.

Write file in `data/json` and `data/xml`.

## Ref

- [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js)
