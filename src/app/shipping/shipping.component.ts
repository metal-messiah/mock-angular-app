import { Component } from '@angular/core';

import { CartService } from '../cart.service';

declare var newrelic: any;

@Component({
  selector: 'app-shipping',
  templateUrl: './shipping.component.html',
  styleUrls: ['./shipping.component.css']
})
export class ShippingComponent {
  shippingCosts = this.cartService.getShippingPrices();



  constructor(private cartService: CartService) {newrelic.addRelease('shipping.component', '0.0.1')
  }


}
