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
    return { cy: null, rawData: null, tipInstances: [] };
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
              'z-index': 10
            }
          },
          {
            selector: 'edge', style: {
              'width': 'mapData(weight, 0, 1, 1, 6)',
              'line-color': '#cfcfcf',
              'curve-style': 'bezier'
            }
          },
          { selector: '.dim', style: { 'opacity': 0.15 } }
        ],
        layout: { name: 'cola', nodeSpacing: 40, edgeLengthVal: 120, animate: true }
      });

      this.addInteractions();
    },

    addInteractions() {
      // Tooltips
      this.cy.nodes().forEach(node => {
        // Virtual reference for tippy anchored to the node's rendered position
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

        // Create a tippy instance (returns a single instance)
        const tip = tippy(document.createElement('div'), {
          content: `${node.data('label')} — ${node.data('era')}`,
          trigger: 'manual',
          placement: 'top',
          animation: 'shift-away',
          theme: 'light',
          // initial virtual reference so tippy can position even before first show
          getReferenceClientRect: () => ref()
        });

        // store instance for cleanup if needed
        this.tipInstances.push({ node, tip, ref });

        node.on('mouseover', () => {
          // update the virtual reference each time (important if graph moves/zooms)
          tip.setProps({ getReferenceClientRect: () => ref() });
          tip.show();
          node.animate({ style: { width: 60, height: 60 } }, { duration: 200 });
        });

        node.on('mouseout', () => {
          tip.hide();
          node.animate({ style: { width: 40, height: 40 } }, { duration: 200 });
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
      // re-run layout for smooth rearrangement
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