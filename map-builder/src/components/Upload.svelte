<script> 
  import XLSX from 'xlsx';
	import uploadIcon from '../assets/img/icon-upload.svg';

  let data = [];
	let vizHeight = 400;

	async function handleInput(e) {
		const file = e.target.files[0];
		const buff = await file.arrayBuffer();
		const workbook = XLSX.read(buff);
		const sheetsList = workbook.SheetNames;
		data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetsList[0]], {
			defval: '',
			blankrows: false
		});
	}

</script>

<main>
	<div class="file">
		<label class="file-label">
			<input class="file-input" type="file" accept=".xls,.xlsx,.csv" on:change={handleInput}>
			<span class="file-cta">
				<span class="file-icon">
					<img src={uploadIcon} class="fas">
				</span>
				<span class="file-label">
					Select your dataset
				</span>
			</span>
		</label>
	</div>
	
	<div class="field">
    <label class="label"> Visualization height </label>
    <div class="control">
      <input class="input" type="number" bind:value={vizHeight}>
    </div>
  </div>
	<!-- {#if data.length > 0} -->
	<slot vizHeight={vizHeight} data={data}></slot>
	<!-- {:else} -->
	<!-- <p> Please select a dataset </p> -->
	<!-- {/if} -->
</main>
