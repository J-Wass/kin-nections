<script lang="ts">
  import type { Tree } from '../lib/model/types'
  import TreeCanvas from './TreeCanvas.svelte'

  interface Props {
    tree: Tree
  }

  let { tree }: Props = $props()
  let selectedPersonId: string | null = $state(null)
  let povPersonId: string | null = $state(null)
  let focusRequestVersion = $state(0)

  function focus(personId: string) {
    selectedPersonId = personId
    povPersonId = personId
    focusRequestVersion += 1
  }
</script>

<TreeCanvas
  {tree}
  {selectedPersonId}
  {povPersonId}
  {focusRequestVersion}
  onSelectPerson={(personId) => (selectedPersonId = personId)}
  onFocusPerson={focus}
  onStandardView={() => (povPersonId = null)}
/>
