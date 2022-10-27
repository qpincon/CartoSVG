<script>

export let data = [];

$: headers = data.length ? Object.keys(data[1]) : [];

</script>

<table class="table">
    <thead>
        <tr> 
            {#each headers as header }
            <th scope="col"> { header } </th>
            {/each}
        </tr>
    </thead>

    <tbody>
        {#each data as row}
            <tr> 
                {#each headers as header }
                    <td> { row[header] } </td>
                {/each}
            </tr>
        {/each}
    </tbody>
</table>

<style scoped>
th {
    white-space: nowrap;
}

</style>