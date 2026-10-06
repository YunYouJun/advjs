# Tree

<TreeDemo />

<<< @/.vitepress/theme/components/demo/TreeDemo.vue

## 导航与选择

传入 `label` 命名树，使用 `v-model:current-node` 同步当前节点。未传入当前节点时，组件保留本地选择。原有节点事件、`expanded` / `visible` / `selectable` 数据接口继续有效；`selectable` 表示允许右键选择，与当前行的选中状态不同。

- Tab 进入当前焦点行（首次进入为选中行或第一行）；上下方向键移动，Home / End 到首尾。
- 右方向键展开或进入第一个子节点；左方向键折叠或返回父节点。
- Space 选择当前行；Enter 选择并触发 `node-dblclick` 的打开行为。
- 移动焦点不会触发文件打开或选择，焦点环与蓝色选中背景分别表示两种状态。
- 当前行的可见性／可选性按钮可以用 Tab 操作；展开按钮的键盘等价操作是左右方向键。

树使用 `tree` / `treeitem` / `group` 语义，叶节点不声明展开状态。单击展开图标与双击打开仍可区分，待执行的展开操作会随卸载取消。键盘模型参考 [WAI-ARIA Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)。
