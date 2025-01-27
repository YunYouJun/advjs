<template>
  <div class="sidebar h-screen w-15 flex flex-col bg-gray-800 text-white">
    <div class="sidebar-header border-b border-gray-700 p-4">
      <h2 class="text-lg font-semibold">
        Sidebar
      </h2>
    </div>
    <div class="sidebar-content flex-1 overflow-y-auto p-4">
      <ul>
        <li class="mb-2">
          <a href="#" class="block rounded p-2 hover:bg-gray-700">Item 1</a>
        </li>
        <li class="mb-2">
          <a href="#" class="block rounded p-2 hover:bg-gray-700">Item 2</a>
        </li>
        <li class="mb-2">
          <a href="#" class="block rounded p-2 hover:bg-gray-700">Item 3</a>
        </li>
      </ul>
    </div>
    <div class="sidebar-footer border-t border-gray-700 p-4">
      <button class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
        Action Button
      </button>
    </div>
  </div>
</template>
