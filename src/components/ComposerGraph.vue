<template>
  <div class="graph-wrap">
    <div ref="cyContainer" id="cy"></div>
  </div>
</template>

<script>
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import gsap from 'gsap';

cytoscape.use(cola);

export default {
  name: 'ComposerGraph',
  props: {
    dataUrl: { type: String, required: true },
    filterEra: { type: String, default: '' }
  },
  emits: ['open-card'],
  data() {
    return { cy: null, rawData: null, tipInstances: [], _dragTrack: new Map() };
  },
  watch: {
    filterEra() { this.applyFilter(); }
  },
  mounted() {
    fetch(this.dataUrl).then(r => r.json()).then(json => {
      this.rawData = json;
      this.initCy(json);
    });
    window.addEventListener('resize', this.resize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.resize);
    if (this.cy) this.cy.destroy();
  },
  methods: {
    initCy(data) {
      const elements = {
        nodes: data.nodes.map(n => ({ data: { id: n.id, label: n.label, era: n.era, movement: n.movement, works: n.works, image: n.image } })),
        edges: data.edges.map(e => ({ data: { source: e.source, target: e.target, weight: e.weight } }))
      };

      this.cy = cytoscape({
        container: this.$refs.cyContainer,
        elements,
        style: [
          {
            selector: 'node', style: {
              'label': 'data(label)',
              'width': 40,
              'height': 40,
              'background-color': '#2b7cff',
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': 10,
              'overlay-padding': '6px',
              'z-index': 10,
              'transition-property': 'width, height, background-color',
              'transition-duration': '200ms'
            }
          },
          {
            selector: 'edge', style: {
              'width': 'mapData(weight, 0, 1, 1, 6)',
              'line-color': '#cfcfcf',
              'curve-style': 'bezier',
              'opacity': 0.9
            }
          },
          { selector: '.dim', style: { 'opacity': 0.15 } }
        ],
        layout: { name: 'cola', nodeSpacing: 40, edgeLengthVal: 120, animate: true },
        wheelSensitivity: 0.1
      });

      // améliorations d'UX
      this.enableSmoothZoom();
      this.enableHoverAnimations();
      this.enableDragInertia();

      this.addInteractions();
    },

    /* -------------------------
       Smooth zoom (GSAP interpolation)
       ------------------------- */
    enableSmoothZoom() {
      const container = this.$refs.cyContainer;
      let targetZoom = null;
      let targetPan = null;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const vm = this;

      container.addEventListener('wheel', e => {
        e.preventDefault();
        if (!vm.cy) return;

        // normalize deltaY across devices
        // deltaMode: 0 = pixels, 1 = lines, 2 = pages
        const modeFactor = (e.deltaMode === 1) ? 16 : (e.deltaMode === 2 ? 800 : 1);
        const rawDelta = -e.deltaY * modeFactor;

        // detect pinch gestures on macOS (ctrlKey) and treat them similarly
        const isPinch = !!e.ctrlKey;

        // sensitivity: slightly higher for physical wheel
        const baseFactor = isPinch ? 0.0025 : 0.0022;
        const zoomFactor = baseFactor;

        const zoom = vm.cy.zoom();
        const newZoom = clamp(zoom * (1 + rawDelta * zoomFactor), 0.2, 3);

        // compute pan so that mouse point stays under cursor
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // compute new pan to keep focus
        const zoomRatio = newZoom / zoom;
        const pan = vm.cy.pan();
        const newPanDelta = {
          x: (mouseX - pan.x) - zoomRatio * (mouseX - pan.x),
          y: (mouseY - pan.y) - zoomRatio * (mouseY - pan.y)
        };

        targetZoom = newZoom;
        targetPan = { x: pan.x + newPanDelta.x, y: pan.y + newPanDelta.y };

        // cancel previous tween if any
        if (vm._zoomTween) {
          vm._zoomTween.kill();
          vm._zoomTween = null;
        }

        // animate with GSAP: keep 'this' inside onUpdate as tween instance,
        // and use vm to access component/cytoscape
        vm._gsapZoomStart = vm.cy.zoom();
        vm._gsapPanStart = { ...vm.cy.pan() };

        vm._zoomTween = gsap.to({}, {
          duration: 0.45,
          ease: 'power3.out',
          onUpdate: function () {
            // 'this' here is the tween instance; progress() exists
            const t = this.progress();
            const z = vm._gsapZoomStart + (targetZoom - vm._gsapZoomStart) * t;
            const px = vm._gsapPanStart.x + (targetPan.x - vm._gsapPanStart.x) * t;
            const py = vm._gsapPanStart.y + (targetPan.y - vm._gsapPanStart.y) * t;

            requestAnimationFrame(() => {
              vm.cy.zoom(z);
              vm.cy.pan({ x: px, y: py });
            });
          },
          onComplete: () => {
            vm._zoomTween = null;
          }
        });
      }, { passive: false });
    },

    /* -------------------------
       Hover animations (scale + subtle shadow)
       ------------------------- */
    enableHoverAnimations() {
      // use cytoscape events to trigger GSAP tweens on DOM elements
      this.cy.nodes().forEach(node => {
        node.on('mouseover', () => {
          // scale node visually by changing width/height via style (animated)
          gsap.to(node, {
            duration: 0.22, ease: 'power2.out', onUpdate: () => {
              // animate via cytoscape style changes
              node.style('width', 60);
              node.style('height', 60);
            }
          });
          // optional: add a subtle glow by adding a class or changing background
          node.style('background-color', '#4da3ff');
        });

        node.on('mouseout', () => {
          gsap.to(node, {
            duration: 0.22, ease: 'power2.out', onUpdate: () => {
              node.style('width', 40);
              node.style('height', 40);
            }
          });
          node.style('background-color', '#2b7cff');
        });
      });
    },

    /* -------------------------
       Drag inertia: track positions during drag and animate after free
       ------------------------- */
    enableDragInertia() {
      // track positions while dragging to compute velocity
      this.cy.on('grab', 'node', evt => {
        const node = evt.target;
        // initialize track array
        this._dragTrack.set(node.id(), []);
        // listen to position changes while grabbed
        const onPos = () => {
          const arr = this._dragTrack.get(node.id()) || [];
          arr.push({ t: Date.now(), x: node.position('x'), y: node.position('y') });
          // keep last 6 samples
          if (arr.length > 6) arr.shift();
          this._dragTrack.set(node.id(), arr);
        };
        node.on('position', onPos);
        // store handler so we can remove later
        node.___onPosHandler = onPos;
      });

      this.cy.on('free', 'node', evt => {
        const node = evt.target;
        const samples = this._dragTrack.get(node.id()) || [];
        // remove position listener
        if (node.___onPosHandler) {
          node.removeListener('position', node.___onPosHandler);
          delete node.___onPosHandler;
        }
        if (samples.length < 2) return;

        // compute velocity from last samples
        const last = samples[samples.length - 1];
        // find sample ~50ms before last if possible
        let prev = samples[0];
        for (let i = samples.length - 2; i >= 0; i--) {
          if (last.t - samples[i].t > 40) { prev = samples[i]; break; }
        }
        const dt = (last.t - prev.t) / 1000 || 0.016;
        const vx = (last.x - prev.x) / dt;
        const vy = (last.y - prev.y) / dt;

        // apply inertia: animate node position with exponential decay
        const decay = 0.92; // friction per frame
        let posX = last.x;
        let posY = last.y;
        let velX = vx * 0.02; // scale down to sensible px/frame
        let velY = vy * 0.02;

        // lock layout for this node so layout doesn't fight the animation
        const wasLocked = node.locked();
        node.lock();

        const step = () => {
          // apply velocity
          posX += velX;
          posY += velY;
          // apply friction
          velX *= decay;
          velY *= decay;
          // set position
          node.position({ x: posX, y: posY });
          // stop condition: velocity small
          if (Math.abs(velX) > 0.1 || Math.abs(velY) > 0.1) {
            requestAnimationFrame(step);
          } else {
            // unlock node and let cytoscape handle rest
            if (!wasLocked) node.unlock();
          }
        };
        requestAnimationFrame(step);

        // cleanup
        this._dragTrack.delete(node.id());
      });
    },

    addInteractions() {
      // Tooltips
      this.cy.nodes().forEach(node => {
        const ref = () => {
          const pos = node.renderedPosition();
          return {
            width: 0,
            height: 0,
            top: pos.y,
            bottom: pos.y,
            left: pos.x,
            right: pos.x
          };
        };

        const tip = tippy(document.createElement('div'), {
          content: `${node.data('label')} — ${node.data('era')}`,
          trigger: 'manual',
          placement: 'top',
          animation: 'shift-away',
          theme: 'light',
          getReferenceClientRect: () => ref()
        });

        this.tipInstances.push({ node, tip, ref });

        node.on('mouseover', () => {
          tip.setProps({ getReferenceClientRect: () => ref() });
          tip.show();
          // subtle node pop handled by hover animations
        });

        node.on('mouseout', () => {
          tip.hide();
        });
      });

      // Click open card
      this.cy.on('tap', 'node', evt => {
        const d = evt.target.data();
        this.$emit('open-card', {
          id: d.id,
          label: d.label,
          era: d.era,
          movement: d.movement,
          works: d.works,
          image: d.image
        });
      });

      // Background tap to close card
      this.cy.on('tap', evt => {
        if (evt.target === this.cy) {
          this.$emit('open-card', null);
        }
      });
    },

    applyFilter() {
      if (!this.cy || !this.rawData) return;
      const era = this.filterEra;
      this.cy.nodes().forEach(n => {
        if (!era || n.data('era') === era) n.removeClass('dim');
        else n.addClass('dim');
      });
      const layout = this.cy.layout({ name: 'cola', animate: true, nodeSpacing: 40, edgeLengthVal: 120 });
      layout.run();
    },

    resize() {
      if (this.cy) this.cy.resize();
    }
  }
};
</script>


<style scoped>
.graph-wrap {
  flex: 1;
  position: relative;
}

#cy {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #0f1724 0%, #071022 100%);
}
</style>