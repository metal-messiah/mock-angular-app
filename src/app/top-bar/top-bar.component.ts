import { Component } from '@angular/core';

declare var newrelic: any;
@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.css']
})
export class TopBarComponent {

  constructor(){newrelic.addRelease('top-bar.component', '0.0.1')}
}
