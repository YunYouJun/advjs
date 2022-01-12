# 参与贡献

- [文档写作指南](./writing-guide.md)

## Commit 规范

对 [Angular Commit Message Format](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-format) 的简化与扩展。

- `build`：对构建系统或者外部依赖项进行了修改
- `ci`：对 CI 配置文件或脚本进行了修改
- `docs`：对文档进行了修改
- `feat`：增加新的特征
- `fix`：修复 bug
- `pref`：提高性能的代码更改
- `refactor`：既不是修复 bug 也不是添加特征的代码重构
- `style`：不影响代码含义的修改，比如空格、格式化、缺失的分号等
- `test`：增加确实的测试或者矫正已存在的测试

扩展

- `ui`: 对 UI 部分的修改

强调对某 monorepo 进行修改时，使用 (scope)。

如对 parser 进行功能新增，`feat(parser): xxx`。
