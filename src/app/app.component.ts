import { Component } from '@angular/core';

// interface NR {
//   addRelease: (name: string, ver: string) => void
// }
declare var newrelic: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(){
    newrelic.addRelease('app.component', '0.0.1')
  }
}
