<h2>Map</h2>
<section>
    <ul>
        <li>Scroll to zoom / dezoom on the map</li>
        <li>Click and drag to move the map around</li>
        <li>
            Right-click anywhere on the map or elements on the map to bring a
            popup that will enable to:
            <ul>
                <li>Create points / labels</li>
                <li>Create hand-drawn paths</li>
                <li>Change the style of any map element</li>
            </ul>
        </li>
        <li>
            Double clicking on a label or a legend title will enable its
            edition. <code> ++ </code> will be printed as a new line.
        </li>
    </ul>
    <h4>Only on <strong> "Satellite" </strong> projection:</h4>
    <ul>
        <li>
            Hold the <kbd> Ctrl </kbd> or <kbd> ⌘ </kbd> key while dragging to rotate
            the map around
        </li>
        <li>Hold the <kbd> ⇧ Shift </kbd> key to change the tilt</li>
    </ul>
</section>
<h2>Working with data</h2>
<section>
    <p>
        When selecting a country, some data <strong> already exist </strong> for
        the different regions (typically the name). <br />
        You can <strong> import your own data </strong> using the button on the
        layers panel. Your data <strong> MUST </strong> define a
        <code> name </code>
        field for the application to know where to show the data. <br />
        To get you started with the data, you can
        <strong> export the existing one </strong>, and fill it by hand or
        joining it with the data that you have.
    </p>
</section>
<h2>Project</h2>
<section>
    <p>
        The state of the current project is <strong> preserved locally </strong>
        in your browser. To transfer it or make sure to keep it, you can
        <strong> save it </strong>
        (<code> Project > Save </code>
        at the bottom of the map). You can also <strong>reset</strong> the
        current project to the initial state, clicking the <code> Reset </code> button.
    </p>
</section>
<h2>Add a font</h2>
<section>
    <p>
        It is possible to add a font by clicking the <code> Add font </code>
        button at the bottom of the map, and chosing a font on your local storage.
        <br />
        Then, it will be possible to chose it from the editing popup (when editing
        text style), in the <strong> font-family </strong> section.
    </p>
</section>
<h2>While editing a hand-drawn path</h2>
<section>
    <ul>
        <li>Click and drag anywhere on the path to move the whole path</li>
        <li><kbd> Ctrl </kbd> + click anywhere on the path to add a point</li>
        <li>
            <kbd> Ctrl </kbd> + click on a point to remove it. Removing a point when
            there are only two will delete the path
        </li>
    </ul>
</section>

<h2>Export</h2>
<section>
    <p>
        When you are satisfied with your creation, you can <strong>
            export it</strong
        >
        with the "Export" button at the bottom of the map. <br />
        The resulting SVG file will be optimized as much as possible (shape and data-wise), and will follow the
        preferences set in the export modal. <br />
        Feel free to share your creations
        <a href="https://github.com/qpincon/CartoSVG" target="_blank">
            by creating a PR
        </a>, <a href="mailto:pincon.quentin@gmail.com"> or sending me an email at pincon.quentin@gmail.com</a> if you want it to feature in the examples!
    </p>
</section>
