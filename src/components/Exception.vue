<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div class="alert alert-warning">
    <div v-if='exception && exception.errorMessage'>
      <div>
        <b>ERROR:</b> {{ exception.errorMessage ? exception.errorMessage : exception }}
      </div>
      <div v-if='exception.stackTrace && exception.stackTrace.length > 0 && $store.state.showFullStackTrace'>
        <hr>
        <h3>Stack Trace</h3>
        <pre><code>{{ exception.stackTrace }}</code></pre>
      </div>
    </div>
    <div v-else>
      <pre>{{ exception }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Exception',
  props: {
    exception: [String, Object, Error]
  }
}
</script>
