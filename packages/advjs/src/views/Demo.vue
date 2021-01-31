<template>
  <div class="adv-game h-screen bg-black" v-bind:style="advGameStyle">
    <base-layer v-show="!$store.state.showUi" />
    <tachie-box :characters="characters" />
    <dialog-box
      v-show="$store.state.showUi"
      :dialog="dialog"
      @click="nextDialog"
    />
    <user-interface v-show="$store.state.showUi" />
  </div>
</template>

<script lang="ts">
import BaseLayer from '../components/base/BaseLayer.vue';
import DialogBox from '../components/dialog/DialogBox.vue';
import TachieBox from '../components/tachie/TachieBox.vue';
import UserInterface from '../components/ui/UserInterface.vue';

import marked from 'marked';
import advParser from '@advjs/parser';
import { AdvItem, Character, Line } from '@advjs/parser/src/Serialize';

import characters from '../data/characters';

export default {
  name: 'Home',
  components: {
    BaseLayer,
    DialogBox,
    TachieBox,
    UserInterface,
  },
  data() {
    return {
      path: './md/test.md',
      advGameStyle: {
        color: 'black',
        backgroundImage: 'url("/img/bg/night.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        padding: 0,
        margin: 0,
      },
      advTextData: [],
      curDialogs: [],
      dialog: {
        name: '',
        words: '',
      },
      characters: characters,
      // 顺序，待优化
      order: 0,
      dialogIndex: 0,
    };
  },
  async mounted() {
    const mdText = await fetch(this.path).then((res) => {
      return res.text();
    });
    const lexed = marked.lexer(mdText);
    (this.advTextData as AdvItem[]) = advParser.parse(lexed);
    this.nextParagraph();
  },
  methods: {
    nextParagraph() {
      while (this.order < this.advTextData.length) {
        const item = this.advTextData[this.order] as AdvItem;
        this.order++;
        if (item.type === 'narration') {
          this.dialog = {
            name: '',
            words: item.text,
          };
          this.updateTachieStatus();
          break;
        }
        if (item.type === 'paragraph') {
          (this.curDialogs as Line[]) = item.children;
          this.nextDialog();
          break;
        }
      }
    },
    nextDialog() {
      if (this.dialogIndex === this.curDialogs.length) {
        this.dialogIndex = 0;
        this.curDialogs = [];
        this.nextParagraph();
      } else if (this.dialogIndex < this.curDialogs.length) {
        const line = this.curDialogs[this.dialogIndex] as Line;
        this.dialog = {
          name: line.character.name,
          words: line.words.text,
        };
        this.updateTachieStatus(line.character);
        this.dialogIndex++;
      }
    },
    updateTachieStatus(character?: Character) {
      this.characters.forEach((curCharacter) => {
        if (character) {
          if (character.name === curCharacter.name) {
            curCharacter.active = true;
            curCharacter.status = character.status
              ? character.status
              : 'default';
          } else {
            curCharacter.active = false;
          }
        } else {
          curCharacter.active = false;
        }
      });
    },
  },
};
</script>

<style>
.adv-game {
  color: white;
}
</style>
