import { defineStore } from 'pinia'
import { createEditorDocumentRegistry } from '../extensions/documents'

export const useExtensionDocuments = defineStore('editor:extension-documents', createEditorDocumentRegistry)
