<template>
  <div class="component menu">
    <template v-for="(toolName, index) in toolNames">
      <div 
        class="menu-item" 
        :key="index" 
        @click="clickedTool(toolName)"
        :class="{ selected: toolSelected === toolName }"
        :style="`z-index: ${100 - index};`"
      >
        <div 
          class="menu-icon"           
          :class="[toolName, { 
            selected: toolSelected === toolName, 
          }]"
        >
          <div 
            v-if="toolName === tools.StrokeColor" 
            class="color-picker stroke"
            :style="`border: 4px ${strokeColor} solid;`"
          ></div>

          <div 
            v-if="toolName === tools.FillColor" 
            class="color-picker fill"
            :style="`background-color: ${fillColor};`"
          ></div>

          <div 
            v-if="toolName === tools.Stroke"
            class="stroke-line" :style="`height: ${strokeWidth * 1.2}px;`"
          ></div>

          <template v-if="toolName === tools.Image">
            <input type="file" id="imgLoader" style="display:none">
          </template>
        </div>

        <p class="tool-name">{{ toolNameMap[toolName] }}</p>

        <div 
          class="submenu" 
          :class="[toolName, { 
            open: selectorOpen && 
              toolSelected === toolName && 
              !(toolName === tools.Math && isMobile),
          }]"
          @click.stop="() => {}"
          :key="index"
        >
          <div 
            v-if="toolsWithDropdown.includes(toolName)"
            class="submenu-content"
            :class="[toolName, { 
              open: selectorOpen && toolSelected === toolName
            }]">
            <template v-if="toolName === tools.Rooms">
              <p class="menu-text">Join/create room: </p>
              <input type="text" v-model="potentialRoomName"/>
              <button @click="goToRoom">Go</button>
            </template>

            <template v-else-if="toolName === tools.StrokeColor || toolName === tools.FillColor">
              <color-picker :value="colors" @input="updateColor"></color-picker>
            </template>

            <template 
              v-else-if="toolName === tools.Stroke" 
              v-for="(size, index) in strokeWidths"
            >
                <div class="menu-item" @click="changeStrokeWidth(size)" :key="index">
                  <div class="stroke-line" :style="`height: ${size * 1.2}px;`"></div>
                </div>
            </template>

            <template 
              v-else-if="toolName === tools.Select"
              v-for="(clipToolName, index) in clipToolNames"
            >
              <div class="menu-item" :key="index">
                <div 
                  class="menu-icon" 
                  :class="clipToolName"
                  @click="clickedClipTool(clipToolName)"
                >
                </div>

                <p class="tool-name">{{ clipToolNameMap[clipToolName] }}</p>
              </div>
            </template>

            <template v-else-if="toolName === tools.Math && !isMobile">
              <a 
                class="menu-text math-instructions" 
                href="https://mathlive.io/reference_shortcuts.html" 
                target="_blank"
              >
                How to use math typing
              </a>
            </template>

            <template v-else-if="toolName === tools.Polygon">
              <p 
                class="menu-text"
              >
              {{ 
                isMobile 
                  ? 'Tap to add a point, long press to finish' 
                  : 'Click to add a point, double click to finish' 
              }}
              </p>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { Compact } from 'vue-color';
import { Tools, ClipTools } from '../types';

@Component({
  components: {
    'color-picker': Compact
  },
})
export default class Menu extends Vue {
  private tools: any = Tools;
  private clipTools = ClipTools;
  private toolNames: string[] = Object.values(this.tools);
  private clipToolNames: string[] = Object.values(this.clipTools);
  private colors: any = {};
  private potentialRoomName = "";
  private strokeWidths = [1, 4, 7, 10];
  private toolsWithDropdown = [
    Tools.Stroke,
    Tools.StrokeColor,
    Tools.FillColor,
    Tools.Math,
    Tools.Select,
    Tools.Polygon,
    Tools.Rooms
  ];
  private toolNameMap = {
    [Tools.Pen]: 'Pen',
    [Tools.Stroke]: 'Width',
    [Tools.Line]: 'Line',
    [Tools.StrokeColor]: 'Stroke',
    [Tools.Arrow]: 'Arrow',
    [Tools.FillColor]: 'Fill',
    [Tools.Text]: 'Text',
    [Tools.Math]: 'Math',
    [Tools.Rectangle]: 'Rect',
    [Tools.Image]: 'Image',
    [Tools.Ellipse]: 'Ellipse',
    [Tools.Select]: 'Select',
    [Tools.Polygon]: 'Poly',
    [Tools.Pan]: 'Pan',
    [Tools.Undo]: 'Undo',
    [Tools.Clear]: 'Clear',
    [Tools.Redo]: 'Redo',
    [Tools.Rooms]: 'Rooms'
  };
  private clipToolNameMap = {
    [ClipTools.Cut]: 'Cut',
    [ClipTools.Copy]: 'Copy',
    [ClipTools.Paste]: 'Paste',
    [ClipTools.Delete]: 'Delete'
  };

  @Prop({ default: false })
  private readonly selectorOpen?: boolean;

  @Prop()
  private readonly toolSelected?: Tools;

  @Prop()
  private readonly strokeColor?: string;

  @Prop()
  private readonly fillColor?: string;

  @Prop()
  private readonly strokeWidth?: number;

  @Prop()
  private readonly roomName?: string;

  @Prop()
  private readonly isMobile?: boolean;

  private created() {
    this.potentialRoomName = this.$route.params.room || ''; 
  }

  private mounted() {
    document.getElementById('imgLoader')!.onchange = (e: any) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imgObj = new Image();
        imgObj.src = event.target!.result as string;
        imgObj.onload = () => {
          this.$emit('img-uploaded', imgObj);
        };
      };
      reader.readAsDataURL(e.target.files[0]);
    };
  }

  private clickedTool(toolName: string) {
    if (toolName === Tools.Image) {
      document.getElementById('imgLoader')!.click();
    } else {
      this.$emit('tool-selected', toolName);
    }
  }

  private clickedClipTool(toolName: string) {
    this.$emit('clip-tool-selected', toolName);
  }

  private updateColor(value: any) {
    this.$emit('update-color', value);
  }

  private changeStrokeWidth(value: number) {
    this.$emit('update-stroke', value);
  }

  private goToRoom() {
    this.$emit('go-to-room', this.potentialRoomName);
  }
}
</script>

<style scoped lang="less">
.component {
  &.menu {
    @label-font-size: 14px;
    @help-font-size: 16px;
    @anim-duration: 0.6s;
    @anim-prep-duration: 0.001s;
    @default-pad: 4px;
    @primary-background: #dddddd;
    @secondary-background: #bbbbbb;
    @menu-button-size: 50px;
    @menu-icon-size: @menu-button-size - @default-pad * 2;

    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    position: fixed;
    top: 0px;
    left: calc((100% - 314px)/2);
    width: (6 * @menu-button-size) + 14;
    z-index: 2;

    .menu-text {
      font-size: @help-font-size;
      font-family: Avenir, Helvetica, Arial, sans-serif;
      color: black;
      margin: 0;
      white-space: wrap;
      align-items: center;
      &.math-instructions {
        margin-bottom: 4px;
      }
    }

    .menu-item {
      display: flex;
      flex-direction: column;
      position: relative;
      width: @menu-button-size;
      height: @menu-button-size - 8;
      background-color: @primary-background;
      border: 1px @secondary-background solid;
      align-items: center;
      justify-content: center;
      padding-top: @default-pad;
      padding-bottom: @default-pad;
      cursor: pointer;
      &.selected {
        background-color: @secondary-background;
      }
      .tool-name {
        top: 0;
        padding-top: 2px;
        font-size: @label-font-size;
        font-weight: 900;
        color: black;
        margin-top: 0;
        margin-bottom: 0;
        line-height: 14px;
      }
      .stroke-line {
        width: 24px;
        height: 4px;
        border-radius: 2px;
        background-color: black;
      }
      .menu-icon {
        display: flex;
        width: @menu-icon-size;
        height: @menu-icon-size;
        background-repeat: no-repeat;
        background-position: center;
        margin-left: 2px;
        align-items: center;
        justify-content: center;
        .color-picker {
          border-radius: 50%;
          &.stroke {
            height: 16px;
            width: 16px;
          }
          &.fill {
            height: 24px;
            width: 24px;
            background-color: rgba(0, 0, 0, 0);
          }
        }
        &.rooms {
          background-image: url('../assets/rooms.svg');
        }
        &.pen {
          background-image: url('../assets/pen.svg');
        }
        &.line {
          background-image: url('../assets/line.svg');              
        }
        &.arrow {
          background-image: url('../assets/arrow.svg');              
        }
        &.rectangle {
          background-image: url('../assets/rectangle.svg');              
        }
        &.ellipse {
          background-image: url('../assets/ellipse.svg');              
        }
        &.polygon {
          background-image: url('../assets/polygon.svg');              
        }
        &.text {
          background-image: url('../assets/text.svg');             
        }
        &.select {
          background-image: url('../assets/select.svg');              
        }
        &.pan {
          background-image: url('../assets/pan.svg');              
        }
        &.clear {
          background-image: url('../assets/clear.svg');              
        }
        &.undo {
          background-image: url('../assets/undo.svg');              
        }
        &.redo {
          background-image: url('../assets/redo.svg');              
        }
        &.math {
          background-image: url('../assets/math.svg');              
        }
        &.image {
          background-image: url('../assets/image.svg');              
        }
        &.cut {
          background-image: url('../assets/cut.svg');
        }
        &.copy {
          background-image: url('../assets/copy.svg');             
        }
        &.paste {
          background-image: url('../assets/paste.svg');
        }
        &.delete {
          background-image: url('../assets/delete.svg');             
        }
      }
      .submenu {
        position: absolute;
        top: @menu-button-size + 2;
        cursor: default;
        z-index: 101;
        overflow: hidden;
        height: 0;
        max-height: 0;
        width: @menu-button-size;
        transition: height @anim-prep-duration @anim-duration;
        -webkit-transition: height @anim-prep-duration @anim-duration;
        &.open {
          height: auto;
          max-height: 320px;
          transition: height @anim-prep-duration;
          -webkit-transition: height @anim-prep-duration;
        }
        &.rooms, &.polygon, &.stroke-color, &.fill-color {
          right: 0;
        }
        &.stroke-color, &.fill-color {
          height: auto;
          width: auto;
          margin: 0;
          padding: 0;
        }
        &.math {
          left: 0;
          width: 180px;
          height: 50px;
        }
        &.rooms, &.polygon {
           width: 140px;
          input {
            width: 80px;
          }
        }
        .submenu-content {
          display: flex;
          flex-direction: column;
          height: auto;
          max-height: 0;
          width: 100%;
          align-items: center;
          transform: translateY(-100%);
          transition: transform @anim-duration;
          -webkit-transition: transform @anim-duration;
          -webkit-transition: -webkit-transform @anim-duration;
          background-color: @secondary-background;
          z-index: 102;
          &.open {
            max-height: 320px;
            height: auto;
            transform: translateY(0%);
            transition: transform @anim-duration @anim-prep-duration;
            -webkit-transition: transform @anim-duration @anim-prep-duration;
            -webkit-transition: -webkit-transform @anim-duration @anim-prep-duration;
          }
        }
      }
    }
  }
}
</style>