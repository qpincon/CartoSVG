<script>

import { sortBy } from '../util/common';

export let data = [];
export let idCol = null;

$: headers = data.length ? Object.keys(data[0]) : [];
$: sortedData = sortBy(data, idCol);

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
        {#each sortedData as row}
            <tr> 
                {#each headers as header }
                    <td> { row[header] } </td>
                {/each}
            </tr>
        {/each}
    </tbody>
</table>