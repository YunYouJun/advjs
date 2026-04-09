/**
 * Virtual scroll utilities for long lists.
 *
 * @tanstack/vue-virtual is installed and ready for use.
 *
 * Usage example for fixed-height items:
 * ```vue
 * <script setup>
 * import { useVirtualizer } from '@tanstack/vue-virtual'
 * import { ref } from 'vue'
 *
 * const parentRef = ref<HTMLElement | null>(null)
 * const items = ref([...]) // your data array
 *
 * const virtualizer = useVirtualizer({
 *   count: items.value.length,
 *   getScrollElement: () => parentRef.value,
 *   estimateSize: () => 72, // estimated item height in px
 * })
 * </script>
 *
 * <template>
 *   <div ref="parentRef" style="height: 100%; overflow: auto;">
 *     <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
 *       <div
 *         v-for="row in virtualizer.getVirtualItems()"
 *         :key="row.index"
 *         :style="{
 *           position: 'absolute',
 *           top: 0,
 *           left: 0,
 *           width: '100%',
 *           transform: `translateY(${row.start}px)`,
 *         }"
 *       >
 *         {{ items[row.index] }}
 *       </div>
 *     </div>
 *   </div>
 * </template>
 * ```
 *
 * For dynamic heights (e.g. chat messages with markdown):
 * Use `measureElement` callback on each item to report actual rendered height.
 *
 * Note: Ionic's IonContent uses its own scroll container. To use virtual scrolling
 * with IonContent, get the scroll element via:
 *   const contentEl = await contentRef.value.$el.getScrollElement()
 *
 * Current mitigation strategies (already in place):
 * - ChatPage: messages capped at 200 in store (MAX_STORED_MESSAGES)
 * - CharacterChatPage: pagination with PAGE_SIZE=50 and "Load earlier" button
 * - WorldPage: character/event lists are typically small (<50 items)
 */
export { useVirtualizer } from '@tanstack/vue-virtual'
