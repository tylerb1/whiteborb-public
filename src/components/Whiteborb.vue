<template>
  <div class="component whiteborb" :style="toolSelected === tools.Pan ? 'cursor: move;' : ''">
    <action-menu 
      :selector-open="selectorOpen"
      :tool-selected="toolSelected"
      :stroke-color="strokeColor"
      :fill-color="fillColor"
      :stroke-width="strokeWidth"
      :room-name="roomName"
      :is-mobile="isMobile"
      @img-uploaded="imageUploaded"
      @tool-selected="clickedTool"
      @clip-tool-selected="clickedClipTool"
      @update-color="updateColorValue"
      @update-stroke="updateStrokeWidth"
      @go-to-room="goToRoom"
    />

    <div id="canvas-container">
      <canvas id="canvas"/>
    </div>

    <div id="coffee">
      <link 
        href="https://fonts.googleapis.com/css?family=Cookie" 
        rel="stylesheet"
      >
      <a 
        class="bmc-button" 
        target="_blank" 
        href="https://www.buymeacoffee.com/tylerb"
      >
        <img 
          src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" 
          alt="Buy me a coffee"
        >

        <span style="margin-left:5px; font-size:28px !important;">Buy me a coffee</span>
      </a>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import io from 'socket.io-client';
import { fabric } from 'fabric-with-gestures';
import cryptoRandomString from 'crypto-random-string';
import MathLive from 'mathlive';
import 'mathlive/dist/mathlive.core.css';
import 'mathlive/dist/mathlive.css';
import domtoimage from 'dom-to-image';
import Menu from './Menu.vue';
import { Tools, ClipTools } from '../types';

@Component({
  components: {
    'action-menu': Menu
  },
})
export default class Whiteborb extends Vue {
  private socket: any = {};
  private socketLoaded = false;
  private canvas: any = null;
  private roomName: string = '';
  private toolSelected: string = '';
  private tools = Tools;
  private selectorOpen: boolean = false;
  private shapeStarted: boolean = false;
  private shapeBeingAdded: any = null;
  private lastPosX: number | null = null;
  private lastPosY: number | null = null;
  private shapeStartX: number = 0;
  private shapeStartY: number = 0;
  private snapshotHistory: any = [];
  private currentSnapshotIndex: number = -1;
  private canRedo: boolean = false;
  private fillColor: string = '#000000';
  private strokeColor: string = '#000000';
  private strokeWidth: number = 3;
  private isTypingMath: boolean = false;
  private polygonPoints: Array<{ x: number, y: number }> = [];
  private clipboard: any = {};
  private nMathFields = 0;
  private currentMathfield: any = null;
  private mathCoords: number[] = [];
  private isMobile = false;
  private shouldSelectTextBox = false;

  private maxNewImageHeight = 500;
  private maxNewImageWidth = 360;

  get isProduction() {
      return window.location.hostname.indexOf('whiteborb') > -1;
  }

  get urlForSocket() {
      const protocol = this.isProduction ? 'https://' : 'http://';
      const hostName = this.isProduction ? window.location.hostname : 'localhost';
      const hostPort = this.isProduction ? 443 : 3000;
      return protocol + hostName + `:${hostPort}`;
  }

  get positionStringsForTool() {
    switch (this.toolSelected) {
      case Tools.Ellipse:
        return { x: 'rx', y: 'ry' };
      case Tools.Line:
      case Tools.Arrow:
        return { x: 'x2', y: 'y2' };
      default:
        return { x: 'width', y: 'height' };
    }
  }

  // BOARD SETUP

  private mounted() {
    this.setRoomName();

    if (/Mobi|Android/i.test(navigator.userAgent)) {
      this.isMobile = true;
    }

    // Set up Fabric.js canvas
    this.canvas = new fabric.Canvas('canvas');
    this.clickedTool(Tools.Pen);
    this.canvas.setWidth(window.innerWidth);
    this.canvas.setHeight(window.innerHeight);
    this.canvas.selectionFullyContained = false;
    fabric.Object.prototype.set({
      transparentCorners: false,
      borderColor: '#63CBAB',
      cornerColor: '#87E5CA',
    });

    this.pushSnapshot();
    this.listenToCanvasEvents();

    // Connect to socket.io
    this.socket = io.connect(this.urlForSocket, { secure: true });

    this.socket.on('got-connected', () => {
      this.socketLoaded = true;
      // Generate room name and create socket.io channel with it
      this.socket.emit('join-room', {
        roomName: this.roomName,
      });
    });

    this.socket.on('send-board-data', (drawData: any) => {
      this.receiveCanvas(drawData);
    });
  }

  // LISTENING TO CANVAS EVENTS

  private listenToCanvasEvents() {
    this.listenToMouseDown();
    this.listenToMouseMove();
    this.listenToMouseUp();
    this.listenToDoubleClick();
    this.listenToTouchGesture();
    this.listenToObjectModified();
  }

  private listenToMouseDown() {
    this.canvas.on('mouse:down', (event: any) => {
      const evt = event.e;
      const mouse = this.canvas.getPointer(evt);

      switch (this.toolSelected) {
        case Tools.Pan:
          if (evt.type.includes('touch')) {
            return;
          }
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
          return;
        case Tools.Rectangle:
        case Tools.Ellipse:
        case Tools.Line:
        case Tools.Arrow:
          this.shapeStarted = true;
          this.shapeStartX = mouse.x;
          this.shapeStartY = mouse.y;
          const options = {
            width: 0,
            height: 0,
            left: this.shapeStartX,
            top: this.shapeStartY,
            fill: this.fillColor,
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
          };
          if (this.toolSelected !== Tools.Arrow) {
            const shape = this.createNewShape(options);
            this.addShape(shape);
            this.canvas.renderAll();
            this.shapeBeingAdded = shape;
          } else {
            const shape = [
              new fabric.Line([
                this.shapeStartX,
                this.shapeStartY,
                this.shapeStartX,
                this.shapeStartY,
              ], options),
              new fabric.Triangle({
                ...options,
                fill: this.strokeColor,
                width: this.strokeWidth * 4,
                height: this.strokeWidth * 4,
                originX: 'center',
                originY: 'center',
                id: 'arrow-pointer'
              })
            ];
            this.addShape(shape[0]);
            this.addShape(shape[1]);
            this.canvas.renderAll();
            this.shapeBeingAdded = shape;
          }
          return;
        default:
          return;
      }
    });
  }

  private listenToMouseMove() {
    this.canvas.on('mouse:move', (event: any) => {
      const evt = event.e;
      const mouse = this.canvas.getPointer(evt);

      if (
        this.toolSelected === Tools.Pan &&
        !!this.lastPosX &&
        !!this.lastPosY &&
        !(evt.type.includes('touch'))
      ) {
        this.canvas.viewportTransform[4] += evt.clientX - this.lastPosX;
        this.canvas.viewportTransform[5] += evt.clientY - this.lastPosY;
        this.canvas.requestRenderAll();
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
      }

      if (this.shapeStarted) {
        if (this.toolSelected === Tools.Arrow) {
          this.dragOutShape(this.shapeBeingAdded[0], mouse);
          this.dragOutShape(this.shapeBeingAdded[1], mouse);
        } else {
          this.dragOutShape(this.shapeBeingAdded, mouse);
        }
        this.canvas.renderAll();
      }
    });
  }

  private listenToMouseUp() {
    this.canvas.on('mouse:up', async (event: any) => {
      const mouse = this.canvas.getPointer(event.e);
      if (this.shouldSelectTextBox) {
        this.shouldSelectTextBox = false;
        this.clickedTool(Tools.Select);
        this.canvas.setActiveObject(this.shapeBeingAdded);
        this.shapeBeingAdded = {};
        this.canvas.renderAll();
        this.pushSnapshot();
        this.sendCanvas();
        return;
      }
      switch (this.toolSelected) {
        case Tools.Math:
          this.addMathField(mouse);
          return;
        case Tools.Pan:
          if (event.e.type.includes('touch')) {
            return;
          }
          this.lastPosX = null;
          this.lastPosY = null;
          return;
        case Tools.Rectangle:
        case Tools.Ellipse:
        case Tools.Line:
        case Tools.Arrow:
        case Tools.Pen:
          if (this.toolSelected === Tools.Arrow) {
            const arrowShape = new fabric.Group(this.shapeBeingAdded);
            this.addShape(arrowShape);
            this.shapeBeingAdded.forEach((shape: any) => {
              this.canvas.remove(shape);
            });
          }
          this.canvas.renderAll();
          this.pushSnapshot();
          this.sendCanvas();
          this.shapeStarted = false;
          this.shapeBeingAdded = {};
          return;
        case Tools.Polygon:
          this.addPolygonPoint(mouse);
          return;
        case Tools.Text:
          this.addText(mouse);
          return;
        default:
          return;
      }
    });
  }

  private listenToDoubleClick() {
    this.canvas.on('mouse:dblclick', async () => {
      this.finishPolygon();
    });

    this.canvas.on('touch:longpress', async (event: any) => {
      const mouse = this.canvas.getPointer(event.e);
      this.addPolygonPoint(mouse);
      this.finishPolygon();
    });
  }

  private listenToTouchGesture() {
    document.getElementById('canvas-container')!
      .addEventListener('touchstart', (e) => {
        if (this.toolSelected === Tools.Pan) {
          this.lastPosX = e.touches[0].clientX;
          this.lastPosY = e.touches[0].clientY;
          this.canvas.selection = false;
        }
      }, false);
    document.getElementById('canvas-container')!
      .addEventListener('touchend', (e) => {
        if (this.toolSelected === Tools.Pan) {
          this.lastPosX = null;
          this.lastPosY = null;
        }
      }, false);
    this.canvas.on('touch:drag', (event: any) => {
      if (event.e.touches && event.e.touches[0]) {
        if (this.toolSelected === Tools.Pan && !!this.lastPosX && !!this.lastPosY) {
          this.canvas.viewportTransform[4] += event.e.touches[0].clientX - this.lastPosX!;
          this.canvas.viewportTransform[5] += event.e.touches[0].clientY - this.lastPosY!;
          this.canvas.requestRenderAll();
          this.lastPosX = event.e.touches[0].clientX;
          this.lastPosY = event.e.touches[0].clientY;
        }
      }
    });
  }

  private listenToObjectModified() {
    this.canvas.on('object:modified', () => {
      this.pushSnapshot();
      this.sendCanvas();
    });
  }
  
  // ADDING SHAPES

  private createNewShape(options: any) {
    switch (this.toolSelected) {
      case Tools.Rectangle:
        return new fabric.Rect(options);
      case Tools.Ellipse:
        const ellipseOpts = {
          originX: 'left',
          originY: 'top',
          rx: 5,
          ry: 1,
          ...options,
        };
        return new fabric.Ellipse(ellipseOpts);
      case Tools.Text:
        return new fabric.IText('Write some text', options);
      case Tools.Line:
        return new fabric.Line([
          this.shapeStartX,
          this.shapeStartY,
          this.shapeStartX,
          this.shapeStartY,
        ], options);
      default:
        return {};
    }
  }

  private dragOutShape(shape: any, mouse: { x: number, y: number}) {
    if (this.toolSelected === Tools.Line || this.toolSelected === Tools.Arrow) {
      if (this.toolSelected === Tools.Arrow && shape.id === 'arrow-pointer') {
        const angle = Math.atan2(
          (mouse.y - this.shapeStartY),
          (mouse.x - this.shapeStartX),
        );
        shape.rotate(fabric.util.radiansToDegrees(angle) + 90);
        shape.set('left', mouse.x + 1).set('top', mouse.y + 2);
      } else {
        shape
          .set(this.positionStringsForTool.x, mouse.x)
          .set(this.positionStringsForTool.y, mouse.y);
      }
    } else {
      shape.set('left', Math.min(mouse.x, this.shapeStartX));
      shape.set('top', Math.min(mouse.y, this.shapeStartY));
      const sizeMultiplier = this.toolSelected === Tools.Ellipse ? 0.5 : 1;
      shape
        .set(this.positionStringsForTool.x, Math.abs(mouse.x - this.shapeStartX) * sizeMultiplier)
        .set(this.positionStringsForTool.y, Math.abs(mouse.y - this.shapeStartY) * sizeMultiplier);
    }
    shape.setCoords();
  }

  private addText(mouse: { x: number, y: number }) {
    const options = {
      left: mouse.x,
      top: mouse.y,
      fill: this.strokeColor,
    };
    const shape = this.createNewShape(options);
    shape.on('editing:exited', () => {
      if (!shape.text.trim()) {
        this.canvas.remove(shape);
      } else {
        this.shouldSelectTextBox = true;
        this.shapeBeingAdded = shape;
      }
    });
    this.addShape(shape);
    this.canvas.setActiveObject(shape);
    this.canvas.renderAll();
    shape.enterEditing();
    shape.selectAll();
  }

  private addPolygonPoint(mouse: { x: number, y: number }) {
    const pt = { x: mouse.x, y: mouse.y };
    this.polygonPoints.push(pt);
    if (this.polygonPoints.length === 1) {
      this.polygonPoints.push({ x: mouse.x + 1, y: mouse.y + 1 });
      const shape = new fabric.Polygon(this.polygonPoints, {
        perPixelTargetFind: true,
        top: mouse.y,
        left: mouse.x,
        fill: this.fillColor,
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth
      });
      this.addShape(shape);
      this.canvas.renderAll();
      this.shapeBeingAdded = shape;
    } else {
      const newPts = this.polygonPoints;
      const activePolygons = this.canvas.getObjects().filter((obj: any) => {
        return obj.type === 'polygon';
      });
      const newObject = activePolygons[0].toObject();
      this.canvas.remove(...activePolygons);
      delete newObject.points;
      delete newObject.top;
      delete newObject.left;
      const shape = new fabric.Polygon(newPts, newObject);
      this.shapeBeingAdded = shape;
      this.addShape(shape);
      this.canvas.renderAll();
    }
  }

  private finishPolygon() {
    if (this.toolSelected === Tools.Polygon && this.polygonPoints.length) {
      this.pushSnapshot();
      this.sendCanvas();
      this.shapeStarted = false;
      this.shapeBeingAdded = {};
      this.polygonPoints = [];
      this.clickedTool(Tools.Select);
    }
  }

  private async addMathField(mouse: { x: number, y: number }) {
    if (this.isTypingMath) {
      const math = document.getElementById(`mathfield-${this.nMathFields}`);
      this.nMathFields += 1;
      const node = document.getElementsByClassName('ML__fieldcontainer__field')[0];
      if (node) {
        const dataUrl = await domtoimage.toSvg(node);
        fabric.Image.fromURL(dataUrl, async (img: any) => {
          img.set('left', this.mathCoords[0]).set('top', this.mathCoords[1]);
          this.addShape(img);
          img.setCoords();
          const canvas = document.getElementById('canvas-container');
          this.currentMathfield.$perform('hide-virtual-keyboard');
          canvas!.removeChild(math!);
          this.currentMathfield = null;
          this.isTypingMath = false;
          this.mathCoords = [];
          this.clickedTool(Tools.Select);
          this.canvas.setActiveObject(img);
          this.canvas.renderAll();
          this.pushSnapshot();
          this.sendCanvas();
        });
      }
    } else {
      const math = document.createElement('div');
      const canvas = document.getElementById('canvas-container');
      math.id = `mathfield-${this.nMathFields}`;
      math.style.position = 'absolute';
      math.style.top = `${mouse.y}px`;
      math.style.left = `${mouse.x}px`;
      this.mathCoords = [mouse.x, mouse.y];
      math.style.paddingLeft = '12px';
      math.style.paddingRight = '12px';
      math.style.border = '1px dotted black';
      canvas!.appendChild(math);
      const field = MathLive.makeMathField(
        `mathfield-${this.nMathFields}`, {
          virtualKeyboardMode: this.isMobile ? 'manual' : 'off',
          onBlur: (f: any) => {
            f.$perform('hide-virtual-keyboard');
          }
        }
      );
      this.currentMathfield = field;
      this.isTypingMath = true;
      field.$focus();
    }
  }

  private imageUploaded(img: HTMLImageElement) {
    const image = new fabric.Image(img);

    // Scale down to smallest iphone size
    if (image.height > this.maxNewImageHeight) {
      image.scaleToHeight(this.maxNewImageHeight);
    }
    if (image.width * image.scaleX > this.maxNewImageWidth) {
      image.scaleToWidth(this.maxNewImageWidth);
    }

    this.canvas.centerObject(image);
    this.addShape(image);
    this.canvas.setActiveObject(image);
    this.canvas.renderAll();
    this.clickedTool(Tools.Select);
  }

  private addShape(shape: any) {
    shape.evented = false;
    shape.selectable = false;
    this.canvas.add(shape);
  }

  // ROOM SELECTION

  private goToRoom(potentialRoomName: string) {
    this.roomName = potentialRoomName;
    this.$router.push({ name: 'Room', params: { room: this.roomName } });
  }

  private setRoomName() {
    if (!this.$route.params.room) {
      this.roomName = cryptoRandomString({
        length: 10,
        characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      });
      this.$router.push({ name: 'Room', params: { room: this.roomName } });
    } else {
      this.roomName = this.$route.params.room;
    }
  }

  // TOOL SELECTION

  private clickedTool(tool: string) {
    this.canvas.selection = (tool === Tools.Select);

    if (tool !== Tools.Stroke && 
        tool !== Tools.FillColor && 
        tool !== Tools.StrokeColor
    ) {
      this.toggleObjectsSelectable(tool === Tools.Select);
    }

    this.canvas.isDrawingMode = (tool === Tools.Pen);

    if (!(Object.values(ClipTools) as string[]).includes(tool)) {
      if (this.toolSelected !== tool) {
        this.toolSelected = tool;
        this.selectorOpen = true;
      } else {
        this.selectorOpen = !this.selectorOpen;
      }
    }

    switch (tool) {
      case Tools.Pen:
        this.canvas.freeDrawingBrush.color = this.strokeColor;
        this.canvas.freeDrawingBrush.width = this.strokeWidth;
        return;
      case Tools.Clear:
        this.canvas.remove(...this.canvas.getObjects());
        this.pushSnapshot();
        this.sendCanvas();
        return;
      case Tools.Undo:
        if (this.currentSnapshotIndex !== 0) {
          this.currentSnapshotIndex -= 1;
          this.canvas.loadFromJSON(
            JSON.parse(this.snapshotHistory[this.currentSnapshotIndex][1]),
            this.canvas.renderAll.bind(this.canvas),
          );
          this.sendCanvas();
          this.canRedo = true;
        }
        return;
      case Tools.Redo:
        if (this.currentSnapshotIndex !== this.snapshotHistory.length - 1 && this.canRedo) {
          this.currentSnapshotIndex += 1;
          this.canvas.loadFromJSON(
            JSON.parse(this.snapshotHistory[this.currentSnapshotIndex][1]),
            this.canvas.renderAll.bind(this.canvas),
          );
          this.sendCanvas();
        }
        return;
      default:
        return;
    }
  }

  private clickedClipTool(tool: string) {
    switch (tool) {
      case ClipTools.Delete:
        if (this.canvas.getActiveObjects()) {
          this.canvas.remove(...this.canvas.getActiveObjects());
          this.canvas.discardActiveObject();
          this.pushSnapshot();
          this.sendCanvas();
        }
        return;
      case ClipTools.Cut:
        this.copyToClipboard(true);
        return;
      case ClipTools.Copy:
        this.copyToClipboard(false);
        return;
      case ClipTools.Paste:
        this.paste();
        return;
      default:
        return;
    }
  }

  private toggleObjectsSelectable(selectable: boolean) {
    this.canvas.discardActiveObject();
    this.canvas.forEachObject((obj: any) => {
      obj.selectable = selectable;
      obj.evented = selectable;
    });
    this.canvas.renderAll();
  }

  private updateColorValue(value: any) {
    if (this.toolSelected === Tools.StrokeColor) {
      this.strokeColor = value.hex;
      if (this.canvas.getActiveObject()) {
        this.canvas.getActiveObject().set('stroke', this.strokeColor);
        this.canvas.renderAll();
      }
    } else {
      this.fillColor = value.hex;
      if (this.canvas.getActiveObject()) {
        this.canvas.getActiveObject().set('fill', this.fillColor);
        this.canvas.renderAll();
      }
    }
    if (this.canvas.isDrawingMode) {
      this.canvas.freeDrawingBrush.color = this.strokeColor;
    }
  }

  private updateStrokeWidth(value: number) {
    this.strokeWidth = value;
    if (this.canvas.getActiveObject()) {
      this.canvas.getActiveObject().set('strokeWidth', this.strokeWidth);
      this.canvas.renderAll();
    }
  }

  // CLIPBOARD
  // adapted from https://codepen.io/agenziabrand/details/QWLKMWz

  private copyToClipboard(shouldCut: boolean) {
    if (!!this.canvas.getActiveObject()) {
      this.canvas.getActiveObject().clone((cloned: any) => {
        this.clipboard = cloned;
        if (shouldCut) {
          this.canvas.remove(this.canvas.getActiveObject());
          this.canvas.discardActiveObject();
        }
      });
      this.pushSnapshot();
      this.sendCanvas();
    }
  }

  private paste() {
    if (!!Object.keys(this.clipboard).length) {
      this.clipboard.clone((clonedObj: any) => {
        this.canvas.discardActiveObject();
        clonedObj.set({
            left: clonedObj.left + 10,
            top: clonedObj.top + 10,
            evented: true,
        });
        if (clonedObj.type === 'activeSelection') {
          clonedObj.canvas = this.canvas;
          clonedObj.forEachObject((obj: any) => {
              this.canvas.add(obj);
          });
          clonedObj.setCoords();
        } else {
          this.canvas.add(clonedObj);
        }
        this.clipboard.top += 10;
        this.clipboard.left += 10;
        this.canvas.setActiveObject(clonedObj);
        this.canvas.renderAll();
      });
      this.pushSnapshot();
      this.sendCanvas();
    }
  }

  // BOARD STATE

  private pushSnapshot() {
    this.currentSnapshotIndex += 1;
    if (this.canRedo) {
      this.snapshotHistory = this.snapshotHistory.slice(0, this.currentSnapshotIndex);
      this.canRedo = false;
    }
    const boardState = JSON.stringify(this.canvas.toJSON());
    this.snapshotHistory.push([Date.now(), boardState]);
  }

  private sendCanvas() {
    const canvasAsJSON = this.canvas.toJSON();
    if (this.socketLoaded) {
      this.socket.emit('send-board-data', {
        canvasData: canvasAsJSON,
        roomName: this.roomName,
      });
    }
  }

  private receiveCanvas(data: any) {
    if (this.socketLoaded && !!data && !!data.canvasData) {
      this.canvas.loadFromJSON(data.canvasData, this.canvas.renderAll.bind(this.canvas));
    }
  }
}
</script>


<style scoped lang="less">
.component {
  &.whiteborb {
    #canvas-container {
      width: 100vw;
      height: 100vh;
      z-index: 0;
      .canvas-container {
        width: 100vw;
        height: 100vh;
      }
    }
    #touch {
      position: absolute;
      top: 100px;
      right: 100px;
    }
    #coffee {
      position: fixed;
      bottom: 0px;
      right: 0px;
      z-index: 10;
      .bmc-button {
        padding: 7px 15px 7px 10px !important;
        line-height: 35px !important;
        height:51px !important;
        text-decoration: none !important;
        display:inline-flex !important;
        color:#ffffff !important;
        background-color:#79D6B5 !important;
        border-radius: 5px !important;
        border: 1px solid transparent !important;
        padding: 7px 15px 7px 10px !important;
        font-size: 28px !important;
        letter-spacing:0.6px !important;
        box-shadow: 0px 1px 2px rgba(190, 190, 190, 0.5) !important;
        -webkit-box-shadow: 0px 1px 2px 2px rgba(190, 190, 190, 0.5) !important;
        margin: 0 auto !important;
        font-family:'Cookie', cursive !important;
        -webkit-box-sizing: border-box !important;
        box-sizing: border-box !important;
        img {
          height: 34px !important;
          width: 35px !important;
          margin-bottom: 1px !important;
          box-shadow: none !important;
          border: none !important;
          vertical-align: middle !important;
        }
        .bmc-button:hover, .bmc-button:active, .bmc-button:focus {
          -webkit-box-shadow: 0px 1px 2px 2px rgba(190, 190, 190, 0.5) !important;
          text-decoration: none !important;
          box-shadow: 0px 1px 2px 2px rgba(190, 190, 190, 0.5) !important;
          opacity: 0.85 !important;
          color:#ffffff !important;
        }
      }
    }
  }
}
</style>