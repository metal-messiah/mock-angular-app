import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import { CartService } from '../cart.service';

declare var newrelic: any;

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {
  items = this.cartService.getItems();
  checkoutForm = this.formBuilder.group({
    name: '',
    address: ''
  });
  constructor(
    private cartService: CartService,
    private formBuilder: FormBuilder,
    ) {


newrelic.addRelease('cart.component', '0.0.1')
    }

  onSubmit(): void {
    // Process checkout data here
      

    try{
      // @ts-ignore
      divide(200)
    } catch(err){
      console.error(err)
      newrelic.noticeError(err)
    }
    

    this.items = this.cartService.clearCart();
    console.warn('Your order has been submitted', this.checkoutForm.value);
    this.checkoutForm.reset();
  }
}
