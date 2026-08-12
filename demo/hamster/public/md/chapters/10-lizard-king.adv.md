---
title: 残暴的蜥蜴王
---

<!-- source:the-common-hamster/lizard-king -->

## 雷克斯暴龙 {#rex}

<!-- scene: prehistoric-grassland / 白垩纪 / 外景 -->

```yaml
type: background
name: prehistoric-grassland
transition:
  name: wipe-right
  duration: 1000
```

```yaml
type: bgm
name: prehistoric
loop: true
fade:
  in: 800
  out: 600
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: curious
    position: right
    motion: slide-right
  - name: 读书人
    status: worried
    position: left
    motion: hop
exit:
  - name: 小仓鼠
    motion: fade
```

@读书人
痛！

> 被摔到眼前的不是恐龙，而是熟悉的读书人。他顾不上抱怨，只指向她背后：锯齿牙、斑驳皮肤、壮硕肌肉和沉重喘息宣告着食物链顶端的身份。

@观测者
最大型、最残暴的肉食动物，白垩纪平原之王——雷克斯暴龙，也就是霸王龙！

> 低含氧参数令这位“残暴蜥蜴王”只有约一百四十厘米高。另一只稍小的霸王龙也出现，像守护领地的夫妇。

@观测者
一人一只。你想烧烤还是清蒸？

@读书人
哪个都不要。没有击退它们的办法吗？

@观测者
弱肉强食本来就是法则——不过，桃太郎饭团。

> 两只霸王龙各自咬住饭团，听令蹲下，长尾耷拉在地。猛兽之王转眼成了坐骑。

```yaml
type: cg
id: tyrannosaurus-encounter
transition:
  name: wipe-left
  duration: 900
```

## 巴 {#ba-appears}

```yaml
type: tachie
enter:
  - name: 巴
    status: afraid
    position: center
    scale: 0.7
    motion: shake
```

> 读书人指向她脚边。一只棕褐色仓鼠蜷成一团，因霸王龙与巨大神明而瑟瑟发抖。它的前肢已趋于细长灵活，也能够直立行走。

@观测者
仓先生，怎么称呼？

@巴
我叫……巴。请问……您是神吗？

@观测者
没错。那位是我的助手。带我们去你们的村落吧。

@巴
遵命，神小姐。

```yaml
type: tachie
enter:
  - name: 巴
    status: hopeful
    position: center
    scale: 0.7
    motion: hop
```

> 她没有让巴步行，而是把它直接放到霸王龙头上。伴着半空中的惨叫，两位神明、巴和霸王龙夫妇向未知方向出发。

- [跟随巴前往仓鼠村落](third-kind#hamster-society)

  ```yaml
  id: follow-ba-home
  ```
